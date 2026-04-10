import { loadConfig } from "../../config";
import type { ApiRouteDefinition } from "../../common";
import { AppError } from "../../common/errors";
import {
  AuthController,
  createAuthControllerRoutes,
  createInMemoryAuthService
} from "../../../modules/auth";
import {
  ClosetController,
  createClosetControllerRoutes,
  createInMemoryClosetService
} from "../../../modules/closet";
import {
  createInMemoryClosetRepository,
  createMySqlClosetRepository
} from "../../../modules/closet/infrastructure";
import {
  RecommendationController,
  createRecommendationControllerRoutes,
  createInMemoryRecommendationService
} from "../../../modules/recommendation";
import { createMySqlRecommendationRepository } from "../../../modules/recommendation/infrastructure";
import {
  StylePackController,
  createInMemoryStylePackService,
  createStylePackControllerRoutes
} from "../../../modules/style-pack";
import {
  createInMemoryStylePackRepository,
  createMySqlStylePackRepository
} from "../../../modules/style-pack/infrastructure";
import {
  TaskCenterController,
  createTaskCenterService,
  createTaskCenterControllerRoutes,
  createInMemoryTaskCenterService
} from "../../../modules/task-center";
import { createMySqlTaskRepository } from "../../../modules/task-center/infrastructure";
import {
  UserProfileController,
  createUserProfileService,
  createInMemoryUserProfileService,
  createUserProfileControllerRoutes
} from "../../../modules/user-profile";
import { createMySqlUserProfileRepository } from "../../../modules/user-profile/infrastructure";
import {
  LlmGatewayController,
  createLlmGatewayControllerRoutes
} from "../../../modules/llm-gateway";
import type { LlmGatewayService } from "../../../modules/llm-gateway";

export function buildHttpRoutes(): ApiRouteDefinition[] {
  const usesMySql = shouldUseMySqlPersistence();
  const taskCenterService = usesMySql
    ? createTaskCenterService({ repository: createMySqlTaskRepository() })
    : createInMemoryTaskCenterService();
  const closetRepository = usesMySql
    ? createMySqlClosetRepository()
    : createInMemoryClosetRepository();
  const stylePackRepository = usesMySql
    ? createMySqlStylePackRepository()
    : createInMemoryStylePackRepository();
  const authController = new AuthController({
    authService: createInMemoryAuthService()
  });
  const userProfileController = new UserProfileController({
    userProfileService: usesMySql
      ? createUserProfileService({ repository: createMySqlUserProfileRepository() })
      : createInMemoryUserProfileService()
  });
  const closetController = new ClosetController({
    closetService: createInMemoryClosetService({
      taskCenterService,
      repository: closetRepository
    })
  });
  const stylePackController = new StylePackController({
    stylePackService: createInMemoryStylePackService({
      repository: stylePackRepository
    })
  });
  const recommendationController = new RecommendationController({
    recommendationService: createInMemoryRecommendationService({
      closetRepository,
      stylePackRepository,
      recommendationRepository: usesMySql
        ? createMySqlRecommendationRepository()
        : undefined
    })
  });
  const taskCenterController = new TaskCenterController({
    taskCenterService
  });
  const llmGatewayController = new LlmGatewayController({
    llmGatewayService: stubLlmGatewayService()
  });

  return [
    ...createAuthControllerRoutes(authController),
    ...createUserProfileControllerRoutes(userProfileController),
    ...createClosetControllerRoutes(closetController),
    ...createStylePackControllerRoutes(stylePackController),
    ...createRecommendationControllerRoutes(recommendationController),
    ...createTaskCenterControllerRoutes(taskCenterController),
    ...createLlmGatewayControllerRoutes(llmGatewayController)
  ];
}

function notImplemented(serviceName: string, methodName: string): never {
  throw new AppError(
    `${serviceName}.${methodName} not implemented`,
    "NOT_IMPLEMENTED",
    501
  );
}

function stubLlmGatewayService(): LlmGatewayService {
  return {
    invoke: async () => notImplemented("LlmGatewayService", "invoke")
  };
}

function shouldUseMySqlPersistence(): boolean {
  return loadConfig().databaseUrl.startsWith("mysql://");
}
