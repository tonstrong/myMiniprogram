import {
  createObjectValidator,
  requiredString,
  optionalString,
  optionalStringArray,
  optionalStringEnum
} from "../../../app/common/validation";
import type {
  GetUserAvatarQueryDTO,
  UpdateUserAvatarRequestDTO,
  UpdateUserProfileRequestDTO
} from "./dtos";

const temperatureSensitivityValues = ["low", "normal", "high"] as const;

export const validateUpdateUserProfileRequest =
  createObjectValidator<UpdateUserProfileRequestDTO>({
    nickname: optionalString({ minLength: 1 }),
    avatarUrl: optionalString({ minLength: 1 }),
    stylePreferences: optionalStringArray({ minLength: 1 }),
    bodyPreferences: optionalStringArray({ minLength: 1 }),
    city: optionalString({ minLength: 1 }),
    defaultTemperatureSensitivity: optionalStringEnum(
      temperatureSensitivityValues
    )
  });

export const validateUpdateUserAvatarRequest =
  createObjectValidator<UpdateUserAvatarRequestDTO>({
    imageBase64: requiredString({ minLength: 1 }),
    contentType: optionalString({ minLength: 1 }),
    filename: optionalString({ minLength: 1 })
  });

export const validateGetUserAvatarQuery =
  createObjectValidator<GetUserAvatarQueryDTO>({
    userId: requiredString({ minLength: 1 }),
    key: requiredString({ minLength: 1 })
  });
