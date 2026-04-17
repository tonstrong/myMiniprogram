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
  status?: "completed" | "failed" | "processing";
  createdAt?: string;
}

export interface RecommendationDetailResponseDTO
  extends GenerateRecommendationResponseDTO {
  status?: "completed" | "failed" | "processing";
  createdAt?: string;
}

export interface HomeRecommendationResponseDTO {
  recommendationId?: string;
  scene?: string;
  reason?: string;
  coverImageUrl?: string;
  status: "completed" | "failed" | "processing" | "empty";
  createdAt?: string;
  displayDate?: string;
}

export interface RecommendationListQueryDTO {
  savedOnly?: number;
  pageNo?: number;
  pageSize?: number;
}

export interface RecommendationListItemDTO {
  recommendationId: string;
  scene: string;
  status: "processing" | "generated" | "validated" | "failed" | "saved";
  createdAt: string;
  coverImageUrl?: string;
}

export interface RecommendationFeedbackRequestDTO {
  action: "like" | "dislike" | "save";
  reasonTags?: string[];
  comment?: string;
}
