import {
  fail,
  formatValidationErrors,
  ok,
  parseRoute,
  validateRequest
} from "../../../app/common";
import type { ApiRequest, ApiRouteDefinition } from "../../../app/common";
import type { ApiResponse } from "../../../app/common/response";
import type { UserProfileService } from "../application";
import type {
  UpdateUserProfileRequestDTO,
  UserProfileResponseDTO
} from "./dtos";
import { UserProfileRoutes } from "./index";
import { validateUpdateUserProfileRequest } from "./validators";

export interface UserProfileControllerDependencies {
  userProfileService: UserProfileService;
}

export class UserProfileController {
  constructor(private readonly deps: UserProfileControllerDependencies) {}

  async getProfile(
    request: ApiRequest
  ): Promise<ApiResponse<UserProfileResponseDTO>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const snapshot = await this.deps.userProfileService.getProfile(userId);

    return ok({
      userId: snapshot.userId,
      nickname: snapshot.nickname,
      avatarUrl: snapshot.avatarUrl,
      stylePreferences: snapshot.stylePreferences,
      bodyPreferences: snapshot.bodyPreferences,
      city: snapshot.city,
      defaultTemperatureSensitivity:
        snapshot.defaultTemperatureSensitivity as UserProfileResponseDTO["defaultTemperatureSensitivity"]
    });
  }

  async updateProfile(
    request: ApiRequest<UpdateUserProfileRequestDTO>
  ): Promise<ApiResponse<UserProfileResponseDTO>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const validation = validateRequest(
      request.body,
      validateUpdateUserProfileRequest
    );
    if (!validation.ok) {
      return fail("INVALID_REQUEST", formatValidationErrors(validation.errors));
    }

    const snapshot = await this.deps.userProfileService.updateProfile({
      userId,
      nickname: validation.value.nickname,
      avatarUrl: validation.value.avatarUrl,
      stylePreferences: validation.value.stylePreferences,
      bodyPreferences: validation.value.bodyPreferences,
      city: validation.value.city,
      defaultTemperatureSensitivity: validation.value.defaultTemperatureSensitivity
    });

    return ok({
      userId: snapshot.userId,
      nickname: snapshot.nickname,
      avatarUrl: snapshot.avatarUrl,
      stylePreferences: snapshot.stylePreferences,
      bodyPreferences: snapshot.bodyPreferences,
      city: snapshot.city,
      defaultTemperatureSensitivity:
        snapshot.defaultTemperatureSensitivity as UserProfileResponseDTO["defaultTemperatureSensitivity"]
    });
  }
}

export function createUserProfileControllerRoutes(
  controller: UserProfileController
): ApiRouteDefinition[] {
  return [
    {
      ...parseRoute(UserProfileRoutes.getProfile),
      summary: "Get user profile",
      handler: controller.getProfile.bind(controller)
    },
    {
      ...parseRoute(UserProfileRoutes.updateProfile),
      summary: "Update user profile",
      handler: controller.updateProfile.bind(controller)
    }
  ];
}
