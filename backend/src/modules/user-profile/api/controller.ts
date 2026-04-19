import {
  binary,
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
  GetUserAvatarQueryDTO,
  UpdateUserAvatarRequestDTO,
  UpdateUserProfileRequestDTO,
  UserProfileResponseDTO
} from "./dtos";
import { UserProfileRoutes } from "./index";
import {
  validateGetUserAvatarQuery,
  validateUpdateUserAvatarRequest,
  validateUpdateUserProfileRequest
} from "./validators";

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

  async updateAvatar(
    request: ApiRequest<UpdateUserAvatarRequestDTO>
  ): Promise<ApiResponse<UserProfileResponseDTO>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const validation = validateRequest(
      request.body,
      validateUpdateUserAvatarRequest
    );
    if (!validation.ok) {
      return fail("INVALID_REQUEST", formatValidationErrors(validation.errors));
    }

    const snapshot = await this.deps.userProfileService.updateAvatar({
      userId,
      imageBase64: validation.value.imageBase64,
      contentType: validation.value.contentType,
      filename: validation.value.filename
    });

    return ok(mapUserProfileSnapshot(snapshot));
  }

  async getAvatar(request: ApiRequest<unknown, GetUserAvatarQueryDTO>) {
    const validation = validateRequest(
      request.query,
      validateGetUserAvatarQuery
    );
    if (!validation.ok) {
      return fail("INVALID_REQUEST", formatValidationErrors(validation.errors));
    }

    const image = await this.deps.userProfileService.getAvatarImage(
      validation.value.userId,
      validation.value.key
    );

    return binary(image.bytes, {
      status: 200,
      headers: {
        "content-type": image.contentType,
        "cache-control": "private, max-age=86400"
      }
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
    },
    {
      ...parseRoute(UserProfileRoutes.updateAvatar),
      summary: "Update user avatar",
      handler: controller.updateAvatar.bind(controller)
    },
    {
      ...parseRoute(UserProfileRoutes.getAvatar),
      summary: "Get user avatar",
      public: true,
      handler: controller.getAvatar.bind(controller)
    }
  ];
}

function mapUserProfileSnapshot(snapshot: {
  userId: string;
  nickname?: string;
  avatarUrl?: string;
  stylePreferences: string[];
  bodyPreferences: string[];
  city?: string;
  defaultTemperatureSensitivity?: string;
}): UserProfileResponseDTO {
  return {
    userId: snapshot.userId,
    nickname: snapshot.nickname,
    avatarUrl: snapshot.avatarUrl,
    stylePreferences: snapshot.stylePreferences,
    bodyPreferences: snapshot.bodyPreferences,
    city: snapshot.city,
    defaultTemperatureSensitivity:
      snapshot.defaultTemperatureSensitivity as UserProfileResponseDTO["defaultTemperatureSensitivity"]
  };
}
