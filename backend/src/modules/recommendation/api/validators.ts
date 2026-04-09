import {
  createObjectValidator,
  optionalObjectField,
  optionalString,
  optionalStringArray,
  requiredNumber,
  requiredString,
  requiredStringEnum
} from "../../../app/common/validation";
import type {
  GenerateRecommendationRequestDTO,
  RecommendationFeedbackRequestDTO,
  RecommendationWeatherDTO
} from "./dtos";
import type { RecommendationIdParams } from "./controller";

const feedbackActionValues = ["like", "dislike", "save"] as const;

export const validateRecommendationWeather =
  createObjectValidator<RecommendationWeatherDTO>({
    temperature: requiredNumber({ min: -100, max: 100 }),
    condition: requiredString({ minLength: 1 })
  });

export const validateGenerateRecommendationRequest =
  createObjectValidator<GenerateRecommendationRequestDTO>({
    scene: requiredString({ minLength: 1 }),
    weather: optionalObjectField(validateRecommendationWeather),
    stylePackId: optionalString({ minLength: 1 }),
    preferenceTags: optionalStringArray({ minLength: 1 })
  });

export const validateRecommendationFeedbackRequest =
  createObjectValidator<RecommendationFeedbackRequestDTO>({
    action: requiredStringEnum(feedbackActionValues),
    reasonTags: optionalStringArray({ minLength: 1 }),
    comment: optionalString({ minLength: 1 })
  });

export const validateRecommendationIdParams =
  createObjectValidator<RecommendationIdParams>({
    recommendationId: requiredString({ minLength: 1 })
  });
