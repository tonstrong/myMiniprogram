import type { ProviderMeta } from "../../../app/common/types";

export interface RecommendationWeatherDTO {
  temperature: number;
  condition: string;
}

export interface GenerateRecommendationRequestDTO {
  scene: string;
  weather?: RecommendationWeatherDTO;
  stylePackId?: string;
  preferenceTags?: string[];
}

export interface RecommendationAlternativeDTO {
  replaceItemId: string;
  withItemId: string;
  reason?: string;
}

export interface RecommendationOutfitDTO {
  items: string[];
  reason?: string;
  alternatives?: RecommendationAlternativeDTO[];
}

export interface GenerateRecommendationResponseDTO {
  recommendationId: string;
  outfits: RecommendationOutfitDTO[];
  providerMeta?: ProviderMeta;
}

export interface RecommendationDetailResponseDTO
  extends GenerateRecommendationResponseDTO {
  status?: "completed" | "failed" | "processing";
  createdAt?: string;
}

export interface RecommendationFeedbackRequestDTO {
  action: "like" | "dislike" | "save";
  reasonTags?: string[];
  comment?: string;
}
