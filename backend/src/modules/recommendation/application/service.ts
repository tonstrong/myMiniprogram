import { randomUUID } from "crypto";
import { AppError } from "../../../app/common/errors";
import type { JsonValue } from "../../../app/common/persistence";
import type { ProviderMeta } from "../../../app/common/types";
import type { ClosetRepository } from "../../closet/infrastructure";
import type { StylePackRepository } from "../../style-pack/infrastructure";
import { mapStylePackRecordToDetail } from "../../style-pack/infrastructure";
import type { RecommendationRepository } from "../infrastructure";
import {
  createInMemoryRecommendationRepository,
  mapRecommendationRecordsToResult
} from "../infrastructure";
import type {
  GenerateRecommendationCommand,
  RecommendationFeedbackCommand,
  RecommendationOutfit,
  RecommendationResult,
  RecommendationService
} from "./index";
import type {
  RecommendationCandidateFilter,
  RecommendationCandidateProvider,
  RecommendationExplainer,
  RecommendationPlanner,
  RecommendationValidator
} from "./contracts";
import { RecommendationOrchestrator } from "./orchestrator";
import type {
  RecommendationCandidateItem,
  RecommendationOutfitPlan,
  RecommendationStylePackContext,
  RecommendationValidationResult
} from "./types";

const MIN_CANDIDATE_COUNT = 2;

export interface RecommendationServiceDependencies {
  closetRepository: ClosetRepository;
  stylePackRepository: StylePackRepository;
  recommendationRepository: RecommendationRepository;
}

export class InMemoryRecommendationService implements RecommendationService {
  constructor(private readonly deps: RecommendationServiceDependencies) {}

  async generate(
    command: GenerateRecommendationCommand
  ): Promise<RecommendationResult> {
    const stylePackContext = await this.loadStylePackContext(
      command.userId,
      command.stylePackId
    );
    const candidateProvider = this.buildCandidateProvider();
    const candidateFilter = this.buildCandidateFilter();
    const planner = this.buildPlanner(stylePackContext);
    const validator = this.buildValidator();
    const explainer = this.buildExplainer(stylePackContext);

    const orchestrator = new RecommendationOrchestrator({
      candidateProvider,
      candidateFilter,
      planner,
      validator,
      explainer
    });

    const orchestration = await orchestrator.execute(command);
    if (orchestration.status !== "completed" || !orchestration.outfits) {
      throw new AppError(
        orchestration.reason ?? "Unable to generate recommendation",
        "INVALID_REQUEST",
        400
      );
    }

    const recommendationId = generateId();
    const createdAt = new Date().toISOString();
    const providerMeta = resolveProviderMeta(orchestration.providerMeta);
    const outfits = mapPlansToOutfits(orchestration.outfits);
    const createdAtDate = new Date();

    const result: RecommendationResult = {
      recommendationId,
      outfits,
      providerMeta,
      status: "completed",
      createdAt
    };

    await this.deps.recommendationRepository.saveRecommendation({
      id: recommendationId,
      userId: command.userId,
      stylePackId: command.stylePackId ?? null,
      scene: command.scene,
      weatherJson: command.weather as unknown as JsonValue,
      provider: providerMeta?.provider ?? null,
      modelName: providerMeta?.modelName ?? null,
      modelTier: providerMeta?.modelTier ?? null,
      retryCount: providerMeta?.retryCount ?? null,
      validatorResult: orchestration.validation as unknown as JsonValue,
      reasonText: outfits[0]?.reason ?? null,
      status: "generated",
      createdAt: createdAtDate,
      updatedAt: createdAtDate
    });
    await this.deps.recommendationRepository.saveRecommendationItems(
      orchestration.outfits.flatMap((outfit) =>
        outfit.items.map((item) => ({
          id: generateId(),
          recommendationId,
          outfitNo: outfit.outfitNo,
          itemId: item.itemId,
          role: item.role,
          reasonText: outfit.reason ?? null,
          alternativeJson: outfit.alternatives as unknown as JsonValue,
          createdAt: createdAtDate
        }))
      )
    );

    return result;
  }

  async getDetail(
    _userId: string,
    recommendationId: string
  ): Promise<RecommendationResult> {
    const recommendation = await this.deps.recommendationRepository.findById(
      recommendationId
    );
    if (!recommendation || recommendation.userId !== _userId) {
      throw new AppError("Recommendation not found", "NOT_FOUND", 404);
    }
    const items = await this.deps.recommendationRepository.findItemsByRecommendationId(
      recommendationId
    );
    return mapRecommendationRecordsToResult(recommendation, items);
  }

  async feedback(command: RecommendationFeedbackCommand): Promise<void> {
    await this.ensureRecommendationExists(command.recommendationId);
    await this.deps.recommendationRepository.saveFeedback({
      id: generateId(),
      recommendationId: command.recommendationId,
      userId: command.userId,
      action: command.action,
      reasonTags: command.reasonTags as unknown as JsonValue,
      comment: command.comment ?? null,
      createdAt: new Date()
    });
  }

  async save(userId: string, recommendationId: string): Promise<void> {
    const recommendation = await this.deps.recommendationRepository.findById(
      recommendationId
    );
    if (!recommendation || recommendation.userId !== userId) {
      throw new AppError("Recommendation not found", "NOT_FOUND", 404);
    }
    await this.deps.recommendationRepository.updateRecommendation(recommendationId, {
      status: "saved",
      updatedAt: new Date()
    });
  }

  private async ensureRecommendationExists(recommendationId: string): Promise<void> {
    const recommendation = await this.deps.recommendationRepository.findById(
      recommendationId
    );
    if (!recommendation) {
      throw new AppError("Recommendation not found", "NOT_FOUND", 404);
    }
  }

  private buildCandidateProvider(): RecommendationCandidateProvider {
    return {
      fetchCandidates: async (input) => {
        const records = await this.deps.closetRepository.listItemsByUserId(
          input.userId
        );
        return records
          .filter((record) => record.status === "active")
          .map((record) => mapClothingRecordToCandidate(record))
          .filter((candidate): candidate is RecommendationCandidateItem =>
            Boolean(candidate)
          );
      }
    };
  }

  private buildCandidateFilter(): RecommendationCandidateFilter {
    return {
      filter: async (input) => {
        if (input.candidates.length < MIN_CANDIDATE_COUNT) {
          return {
            status: "insufficient_items",
            candidates: input.candidates,
            reason: `At least ${MIN_CANDIDATE_COUNT} active closet items are required.`
          };
        }
        return { status: "ok", candidates: input.candidates };
      }
    };
  }

  private buildPlanner(
    stylePackContext?: RecommendationStylePackContext
  ): RecommendationPlanner {
    return {
      plan: async (input) => {
        if (input.candidates.length < MIN_CANDIDATE_COUNT) {
          return {
            status: "insufficient_items",
            reason: "Not enough candidates to plan outfits.",
            providerMeta: { provider: "mock" }
          };
        }

        const selected = input.candidates.slice(0, MIN_CANDIDATE_COUNT);
        const items = selected.map((candidate, index) => ({
          itemId: candidate.itemId,
          role: index === 0 ? "primary" : "secondary"
        }));

        return {
          status: "success",
          outfits: [
            {
              outfitNo: 1,
              items,
              reason: buildPlannerReason(input.scene, stylePackContext)
            }
          ],
          providerMeta: { provider: "mock" },
          promptVersion: "mock-planner-v1"
        };
      }
    };
  }

  private buildValidator(): RecommendationValidator {
    return {
      validate: async (input) => {
        const candidateIds = new Set(input.candidates.map((candidate) => candidate.itemId));
        const errors = input.outfits
          .flatMap((outfit) =>
            outfit.items
              .filter((item) => !candidateIds.has(item.itemId))
              .map((item) => ({
                code: "missing_item" as const,
                message: "Outfit references an unavailable item.",
                itemId: item.itemId,
                outfitNo: outfit.outfitNo
              }))
          );

        if (errors.length > 0) {
          const result: RecommendationValidationResult = {
            status: "failed",
            errors,
            ruleVersion: "mock-validator-v1"
          };
          return result;
        }

        return {
          status: "passed",
          validatedOutfits: input.outfits,
          ruleVersion: "mock-validator-v1"
        };
      }
    };
  }

  private buildExplainer(
    stylePackContext?: RecommendationStylePackContext
  ): RecommendationExplainer {
    return {
      explain: async (input) => {
        const outfits = input.outfits.map((outfit) => ({
          ...outfit,
          reason:
            outfit.reason ?? buildExplainerReason(input.scene, stylePackContext)
        }));

        return {
          status: "success",
          outfits,
          providerMeta: { provider: "mock" },
          promptVersion: "mock-explainer-v1"
        };
      }
    };
  }

  private async loadStylePackContext(
    userId: string,
    stylePackId?: string
  ): Promise<RecommendationStylePackContext | undefined> {
    if (!stylePackId) {
      return undefined;
    }
    const record = await this.deps.stylePackRepository.findById(stylePackId);
    if (!record || record.userId !== userId || record.status !== "active") {
      return undefined;
    }
    const detail = mapStylePackRecordToDetail(record);
    return {
      summary: detail.summaryText,
      rules: detail.rulesJson,
      promptProfile: detail.promptProfile
    };
  }
}

export function createInMemoryRecommendationService(
  deps: Omit<RecommendationServiceDependencies, "recommendationRepository"> & {
    recommendationRepository?: RecommendationRepository;
  }
): RecommendationService {
  return new InMemoryRecommendationService({
    ...deps,
    recommendationRepository:
      deps.recommendationRepository ?? createInMemoryRecommendationRepository()
  });
}

function mapClothingRecordToCandidate(
  record: {
    id: string;
    category?: string | null;
    subCategory?: string | null;
    colors?: unknown | null;
    tags?: unknown | null;
  }
): RecommendationCandidateItem | null {
  if (!record.category) {
    return null;
  }
  return {
    itemId: record.id,
    category: record.category,
    subCategory: record.subCategory ?? undefined,
    colors: coerceStringArray(record.colors),
    tags: coerceStringArray(record.tags)
  };
}

function coerceStringArray(value?: unknown | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function mapPlansToOutfits(plans: RecommendationOutfitPlan[]): RecommendationOutfit[] {
  return plans.map((plan) => ({
    items: plan.items.map((item) => item.itemId),
    reason: plan.reason,
    alternatives: plan.alternatives?.map((alternative) => ({
      replaceItemId: alternative.replaceItemId,
      withItemId: alternative.withItemId,
      reason: alternative.reason
    }))
  }));
}

function resolveProviderMeta(providerMeta?: {
  planner?: ProviderMeta;
  explainer?: ProviderMeta;
}): ProviderMeta | undefined {
  return providerMeta?.explainer ?? providerMeta?.planner ?? { provider: "mock" };
}

function buildPlannerReason(
  scene: string,
  stylePack?: RecommendationStylePackContext
): string {
  const styleHint = stylePack?.summary ? ` Inspired by ${stylePack.summary}.` : "";
  return `Planned for ${scene}.${styleHint}`;
}

function buildExplainerReason(
  scene: string,
  stylePack?: RecommendationStylePackContext
): string {
  const styleHint = stylePack?.summary ? ` It reflects ${stylePack.summary}.` : "";
  return `Chosen to suit ${scene}.${styleHint}`;
}

function generateId(): string {
  try {
    return randomUUID();
  } catch (error) {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
