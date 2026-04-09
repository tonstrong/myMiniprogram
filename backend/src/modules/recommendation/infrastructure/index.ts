import type {
  RecommendationFeedbackRecord,
  RecommendationItemRecord,
  RecommendationRecord
} from "./persistence";
import type { RecommendationPromptTemplateStore } from "./prompt-templates";

export interface RecommendationRepository {
  saveRecommendation(record: RecommendationRecord): Promise<void>;
  saveRecommendationItems(items: RecommendationItemRecord[]): Promise<void>;
  saveFeedback(record: RecommendationFeedbackRecord): Promise<void>;
  findById(id: string): Promise<RecommendationRecord | null>;
}

export interface RecommendationPromptTemplateRepository
  extends RecommendationPromptTemplateStore {}
