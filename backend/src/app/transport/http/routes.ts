import type { ApiRouteDefinition } from "../../common";
import { AppError } from "../../common/errors";
import {
  AuthController,
  createAuthControllerRoutes
} from "../../../modules/auth";
import type { AuthService } from "../../../modules/auth";
import {
  ClosetController,
  createClosetControllerRoutes
} from "../../../modules/closet";
import type { ClosetService } from "../../../modules/closet";
import {
  RecommendationController,
  createRecommendationControllerRoutes
} from "../../../modules/recommendation";
import type { RecommendationService } from "../../../modules/recommendation";
import {
  StylePackController,
  createStylePackControllerRoutes
} from "../../../modules/style-pack";
import type { StylePackService } from "../../../modules/style-pack";
import {
  TaskCenterController,
  createTaskCenterControllerRoutes
} from "../../../modules/task-center";
import type { TaskCenterService } from "../../../modules/task-center";
import {
  UserProfileController,
  createUserProfileControllerRoutes
} from "../../../modules/user-profile";
import type { UserProfileService } from "../../../modules/user-profile";
import {
  LlmGatewayController,
  createLlmGatewayControllerRoutes
} from "../../../modules/llm-gateway";
import type { LlmGatewayService } from "../../../modules/llm-gateway";

export function buildHttpRoutes(): ApiRouteDefinition[] {
  const authController = new AuthController({ authService: stubAuthService() });
  const userProfileController = new UserProfileController({
    userProfileService: stubUserProfileService()
  });
  const closetController = new ClosetController({
    closetService: stubClosetService()
  });
  const stylePackController = new StylePackController({
    stylePackService: stubStylePackService()
  });
  const recommendationController = new RecommendationController({
    recommendationService: stubRecommendationService()
  });
  const taskCenterController = new TaskCenterController({
    taskCenterService: stubTaskCenterService()
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

function stubAuthService(): AuthService {
  return {
    wechatLogin: async () => notImplemented("AuthService", "wechatLogin"),
    verifyToken: async () => notImplemented("AuthService", "verifyToken"),
    refreshToken: async () => notImplemented("AuthService", "refreshToken")
  };
}

function stubUserProfileService(): UserProfileService {
  return {
    getProfile: async () => notImplemented("UserProfileService", "getProfile"),
    updateProfile: async () =>
      notImplemented("UserProfileService", "updateProfile")
  };
}

function stubClosetService(): ClosetService {
  return {
    uploadItem: async () => notImplemented("ClosetService", "uploadItem"),
    listItems: async () => notImplemented("ClosetService", "listItems"),
    getItem: async () => notImplemented("ClosetService", "getItem"),
    updateItem: async () => notImplemented("ClosetService", "updateItem"),
    confirmItem: async () => notImplemented("ClosetService", "confirmItem"),
    archiveItem: async () => notImplemented("ClosetService", "archiveItem"),
    deleteItem: async () => notImplemented("ClosetService", "deleteItem")
  };
}

function stubStylePackService(): StylePackService {
  return {
    importText: async () => notImplemented("StylePackService", "importText"),
    importVideo: async () => notImplemented("StylePackService", "importVideo"),
    list: async () => notImplemented("StylePackService", "list"),
    getDetail: async () => notImplemented("StylePackService", "getDetail"),
    update: async () => notImplemented("StylePackService", "update"),
    activate: async () => notImplemented("StylePackService", "activate"),
    deactivate: async () => notImplemented("StylePackService", "deactivate")
  };
}

function stubRecommendationService(): RecommendationService {
  return {
    generate: async () => notImplemented("RecommendationService", "generate"),
    getDetail: async () => notImplemented("RecommendationService", "getDetail"),
    feedback: async () => notImplemented("RecommendationService", "feedback"),
    save: async () => notImplemented("RecommendationService", "save")
  };
}

function stubTaskCenterService(): TaskCenterService {
  return {
    createTask: async () => notImplemented("TaskCenterService", "createTask"),
    getTask: async () => notImplemented("TaskCenterService", "getTask"),
    updateTask: async () => notImplemented("TaskCenterService", "updateTask")
  };
}

function stubLlmGatewayService(): LlmGatewayService {
  return {
    invoke: async () => notImplemented("LlmGatewayService", "invoke")
  };
}
