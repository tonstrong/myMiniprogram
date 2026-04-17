import type { PaginatedResult } from "../../../app/common/types";
import type { ProviderMeta } from "../../../app/common/types";
import type { RecommendationWeather } from "./types";

export interface GenerateRecommendationCommand {
  userId: string;
  scene: string;
  weather?: RecommendationWeather;
  stylePackId?: string;
  preferenceTags?: string[];
  preferredItemIds?: string[];
  sourceType?: "manual" | "daily_home";
  displayDate?: string;
}

export interface RecommendationAlternative {
  replaceItemId: string;
  withItemId: string;
  reason?: string;
}

export interface RecommendationOutfit {
  items: string[];
  reason?: string;
  alternatives?: RecommendationAlternative[];
}

export interface RecommendationResult {
  recommendationId: string;
  outfits: RecommendationOutfit[];
  providerMeta?: ProviderMeta;
  status?: "completed" | "failed" | "processing";
  createdAt?: string;
}

export interface HomeRecommendationSnapshot {
  recommendationId: string;
  scene: string;
  reason?: string;
  coverImageUrl?: string;
  status: "completed" | "failed" | "processing" | "empty";
  createdAt?: string;
  displayDate?: string;
}

export interface RecommendationGenerationTaskPayload {
  recommendationId: string;
  userId: string;
  preferredItemIds?: string[];
}

export interface RecommendationHistoryItem {
  recommendationId: string;
  scene: string;
  status: "processing" | "generated" | "validated" | "failed" | "saved";
  createdAt: string;
  coverImageUrl?: string;
}

export interface RecommendationListQuery {
  savedOnly?: boolean;
  pageNo?: number;
  pageSize?: number;
}

export interface RecommendationFeedbackCommand {
  userId: string;
  recommendationId: string;
  action: "like" | "dislike" | "save";
  reasonTags?: string[];
  comment?: string;
}

export interface RecommendationService {
  generate(command: GenerateRecommendationCommand): Promise<RecommendationResult>;
  list(
    userId: string,
    query: RecommendationListQuery
  ): Promise<PaginatedResult<RecommendationHistoryItem>>;
  getDetail(userId: string, recommendationId: string): Promise<RecommendationResult>;
  getHomeDaily(userId: string): Promise<HomeRecommendationSnapshot | null>;
  ensureDailyHomeRecommendation(
    userId: string,
    displayDate?: string
  ): Promise<HomeRecommendationSnapshot | null>;
  processQueuedRecommendationTask(
    payload: RecommendationGenerationTaskPayload
  ): Promise<void>;
  feedback(command: RecommendationFeedbackCommand): Promise<void>;
  save(userId: string, recommendationId: string): Promise<void>;
}

export * from "./service";
export * from "./contracts";
export * from "./orchestrator";
export * from "./prompts";
export * from "./types";
