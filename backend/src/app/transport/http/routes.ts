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
import {
  createInMemoryUserProfileRepository,
  createMySqlUserProfileRepository
} from "../../../modules/user-profile/infrastructure";
import {
  WeatherController,
  createSharedWeatherService,
  createWeatherControllerRoutes
} from "../../../modules/weather";
import {
  createInMemoryWeatherCacheRepository,
  createMySqlWeatherCacheRepository
} from "../../../modules/weather/infrastructure";
import {
  LlmGatewayController,
  createLlmGatewayControllerRoutes
} from "../../../modules/llm-gateway";
import { LlmGatewayServiceImpl } from "../../../modules/llm-gateway/application/gateway-service-impl";
import {
  SavedOutfitController,
  createSavedOutfitControllerRoutes,
  createSavedOutfitService
} from "../../../modules/saved-outfit";
import {
  createInMemorySavedOutfitRepository,
  createMySqlSavedOutfitRepository
} from "../../../modules/saved-outfit/infrastructure";

export function buildHttpRoutes(): ApiRouteDefinition[] {
  const usesMySql = shouldUseMySqlPersistence();
  const llmGatewayService = createLlmGatewayService();
  const taskCenterService = usesMySql
    ? createTaskCenterService({ repository: createMySqlTaskRepository() })
    : createInMemoryTaskCenterService();
  const closetRepository = usesMySql
    ? createMySqlClosetRepository()
    : createInMemoryClosetRepository();
  const stylePackRepository = usesMySql
    ? createMySqlStylePackRepository()
    : createInMemoryStylePackRepository();
  const userProfileRepository = usesMySql
    ? createMySqlUserProfileRepository()
    : createInMemoryUserProfileRepository();
  const weatherRepository = usesMySql
    ? createMySqlWeatherCacheRepository()
    : createInMemoryWeatherCacheRepository();
  const savedOutfitRepository = usesMySql
    ? createMySqlSavedOutfitRepository()
    : createInMemorySavedOutfitRepository();
  const authController = new AuthController({
    authService: createInMemoryAuthService()
  });
  const userProfileController = new UserProfileController({
    userProfileService: usesMySql
      ? createUserProfileService({ repository: userProfileRepository })
      : createInMemoryUserProfileService()
  });
  const closetController = new ClosetController({
    closetService: createInMemoryClosetService({
      taskCenterService,
      repository: closetRepository,
      llmGatewayService
    })
  });
  const stylePackController = new StylePackController({
    stylePackService: createInMemoryStylePackService({
      repository: stylePackRepository,
      llmGatewayService
    })
  });
  const recommendationController = new RecommendationController({
    recommendationService: createInMemoryRecommendationService({
      closetRepository,
      stylePackRepository,
      llmGatewayService,
      weatherService: createSharedWeatherService({
        repository: weatherRepository,
        userProfileRepository
      }),
      userProfileRepository,
      recommendationRepository: usesMySql
        ? createMySqlRecommendationRepository()
        : undefined
    })
  });
  const taskCenterController = new TaskCenterController({
    taskCenterService
  });
  const llmGatewayController = new LlmGatewayController({
    llmGatewayService
  });
  const weatherController = new WeatherController({
    weatherService: createSharedWeatherService({
      repository: weatherRepository,
      userProfileRepository
    })
  });
  const savedOutfitController = new SavedOutfitController({
    savedOutfitService: createSavedOutfitService({
      repository: savedOutfitRepository,
      closetRepository
    })
  });

  return [
    ...createAuthControllerRoutes(authController),
    ...createUserProfileControllerRoutes(userProfileController),
    ...createClosetControllerRoutes(closetController),
    ...createStylePackControllerRoutes(stylePackController),
    ...createRecommendationControllerRoutes(recommendationController),
    ...createTaskCenterControllerRoutes(taskCenterController),
    ...createLlmGatewayControllerRoutes(llmGatewayController),
    ...createWeatherControllerRoutes(weatherController),
    ...createSavedOutfitControllerRoutes(savedOutfitController)
  ];
}

function createLlmGatewayService() {
  return new LlmGatewayServiceImpl();
}

function shouldUseMySqlPersistence(): boolean {
  return loadConfig().databaseUrl.startsWith("mysql://");
}
