import {
  createObjectValidator,
  optionalString,
  optionalStringArray,
  optionalStringEnum
} from "../../../app/common/validation";
import type { UpdateUserProfileRequestDTO } from "./dtos";

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
