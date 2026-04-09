import type { ProviderMeta } from "../../../app/common/types";
import type { RecommendationWeather } from "./types";

export interface GenerateRecommendationCommand {
  userId: string;
  scene: string;
  weather?: RecommendationWeather;
  stylePackId?: string;
  preferenceTags?: string[];
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

export interface RecommendationFeedbackCommand {
  userId: string;
  recommendationId: string;
  action: "like" | "dislike" | "save";
  reasonTags?: string[];
  comment?: string;
}

export interface RecommendationService {
  generate(command: GenerateRecommendationCommand): Promise<RecommendationResult>;
  getDetail(userId: string, recommendationId: string): Promise<RecommendationResult>;
  feedback(command: RecommendationFeedbackCommand): Promise<void>;
  save(userId: string, recommendationId: string): Promise<void>;
}

export * from "./contracts";
export * from "./orchestrator";
export * from "./prompts";
export * from "./types";
