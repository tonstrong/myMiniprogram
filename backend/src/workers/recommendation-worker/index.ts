import type { AppContext } from "../../app/bootstrap/app";
import { AppError } from "../../app/common/errors";
import { createMySqlClosetRepository } from "../../modules/closet/infrastructure";
import { LlmGatewayServiceImpl } from "../../modules/llm-gateway/application/gateway-service-impl";
import {
  createInMemoryRecommendationService,
  type RecommendationGenerationTaskPayload
} from "../../modules/recommendation";
import { createMySqlRecommendationRepository } from "../../modules/recommendation/infrastructure";
import { createMySqlStylePackRepository } from "../../modules/style-pack/infrastructure";
import { createTaskCenterService } from "../../modules/task-center";
import { createMySqlTaskRepository } from "../../modules/task-center/infrastructure";
import { createMySqlUserProfileRepository } from "../../modules/user-profile/infrastructure";
import { createSharedWeatherService } from "../../modules/weather";
import { createMySqlWeatherCacheRepository } from "../../modules/weather/infrastructure";

const RECOMMENDATION_TASK_TYPES = [
  "generate_outfit_recommendations",
  "generate_daily_home_recommendation"
] as const;

export async function runRecommendationWorker(context: AppContext) {
  if (!context.config.databaseUrl.startsWith("mysql://")) {
    context.logger.warn(
      "Recommendation worker requires MySQL persistence; skipping worker startup."
    );
    return;
  }

  const taskRepository = createMySqlTaskRepository();
  const userProfileRepository = createMySqlUserProfileRepository();
  const recommendationRepository = createMySqlRecommendationRepository();
  const taskCenterService = createTaskCenterService({ repository: taskRepository });
  const recommendationService = createInMemoryRecommendationService({
    closetRepository: createMySqlClosetRepository(),
    stylePackRepository: createMySqlStylePackRepository(),
    recommendationRepository,
    taskCenterService,
    llmGatewayService: new LlmGatewayServiceImpl(),
    weatherService: createSharedWeatherService({
      repository: createMySqlWeatherCacheRepository(),
      userProfileRepository
    }),
    userProfileRepository
  });
  const workerId = `recommendation-worker-${process.pid}`;

  context.logger.info(`Recommendation worker started as ${workerId}`);
  void runDailyHomeSweepLoop({
    context,
    recommendationService,
    userProfileRepository
  });

  for (;;) {
    const task = await taskRepository.claimNextReadyTask({
      workerId,
      taskTypes: [...RECOMMENDATION_TASK_TYPES],
      leaseMs: context.config.worker.leaseMs
    });

    if (!task) {
      await sleep(context.config.worker.pollIntervalMs);
      continue;
    }

    const payload = coerceRecommendationTaskPayload(task.payloadJson);
    if (!payload) {
      await taskRepository.update(task.id, {
        status: "failed",
        errorCode: "INVALID_TASK_PAYLOAD",
        errorMessage: "Recommendation task payload is invalid.",
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        updatedAt: new Date()
      });
      continue;
    }

    try {
      await recommendationService.processQueuedRecommendationTask(payload);
      await taskRepository.update(task.id, {
        status: "completed",
        progress: 100,
        resultSummary:
          task.taskType === "generate_daily_home_recommendation"
            ? "Home daily recommendation generated"
            : "Recommendation generated",
        resultJson: {
          recommendationId: payload.recommendationId
        },
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        updatedAt: new Date()
      });
    } catch (error) {
      const now = new Date();
      const message =
        error instanceof Error ? error.message : "Recommendation worker failed";
      const retryable = isRetryableWorkerError(error);

      if (retryable && task.attemptCount < task.maxAttempts) {
        await taskRepository.update(task.id, {
          status: "uploaded",
          progress: 0,
          errorCode: "TASK_RETRY_SCHEDULED",
          errorMessage: message,
          availableAt: new Date(now.getTime() + getRetryDelayMs(task.attemptCount)),
          lockedAt: null,
          lockedBy: null,
          updatedAt: now
        });
        continue;
      }

      await recommendationRepository.updateRecommendation(payload.recommendationId, {
        status: "failed",
        reasonText: message,
        updatedAt: now
      });
      await taskRepository.update(task.id, {
        status: "failed",
        errorCode: retryable ? "TASK_RETRY_EXHAUSTED" : "TASK_FATAL",
        errorMessage: message,
        finishedAt: now,
        lockedAt: null,
        lockedBy: null,
        updatedAt: now
      });
    }
  }
}

async function runDailyHomeSweepLoop(input: {
  context: AppContext;
  recommendationService: ReturnType<typeof createInMemoryRecommendationService>;
  userProfileRepository: ReturnType<typeof createMySqlUserProfileRepository>;
}) {
  for (;;) {
    try {
      const userIds = await input.userProfileRepository.listActiveUserIds();
      for (const userId of userIds) {
        await input.recommendationService.ensureDailyHomeRecommendation(userId);
      }
    } catch (error) {
      input.context.logger.error("Daily home recommendation sweep failed", {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    await sleep(input.context.config.worker.dailyHomeSweepIntervalMs);
  }
}

function coerceRecommendationTaskPayload(
  value: unknown
): RecommendationGenerationTaskPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const data = value as Record<string, unknown>;
  if (typeof data.recommendationId !== "string" || typeof data.userId !== "string") {
    return null;
  }

  return {
    recommendationId: data.recommendationId,
    userId: data.userId,
    preferredItemIds: Array.isArray(data.preferredItemIds)
      ? data.preferredItemIds.filter(
          (itemId): itemId is string => typeof itemId === "string"
        )
      : undefined
  };
}

function isRetryableWorkerError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.status >= 500;
  }
  return true;
}

function getRetryDelayMs(attemptCount: number): number {
  const delays = [15000, 45000, 120000, 300000];
  return delays[Math.max(0, Math.min(attemptCount - 1, delays.length - 1))];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
