import type { ModuleRegistration } from "../common/types";
import { registerAuthModule } from "../../modules/auth";
import { registerUserProfileModule } from "../../modules/user-profile";
import { registerClosetModule } from "../../modules/closet";
import { registerStylePackModule } from "../../modules/style-pack";
import { registerRecommendationModule } from "../../modules/recommendation";
import { registerTaskCenterModule } from "../../modules/task-center";
import { registerLlmGatewayModule } from "../../modules/llm-gateway";
import { registerContentSafetyModule } from "../../modules/content-safety";
import { registerFileStorageModule } from "../../modules/file-storage";

export function buildModuleRegistry(): ModuleRegistration[] {
  return [
    registerAuthModule(),
    registerUserProfileModule(),
    registerClosetModule(),
    registerStylePackModule(),
    registerRecommendationModule(),
    registerTaskCenterModule(),
    registerLlmGatewayModule(),
    registerContentSafetyModule(),
    registerFileStorageModule()
  ];
}
