import type {
  RecommendationExplainerRecord,
  RecommendationFeedbackRecord,
  RecommendationItemRecord,
  RecommendationPlannerRecord,
  RecommendationRecord
} from "./persistence";
import type { RecommendationPromptTemplateStore } from "./prompt-templates";

export interface RecommendationRepository {
  saveRecommendation(record: RecommendationRecord): Promise<void>;
  updateRecommendation(id: string, patch: Partial<RecommendationRecord>): Promise<void>;
  saveRecommendationItems(items: RecommendationItemRecord[]): Promise<void>;
  findItemsByRecommendationId(
    recommendationId: string
  ): Promise<RecommendationItemRecord[]>;
  saveFeedback(record: RecommendationFeedbackRecord): Promise<void>;
  findById(id: string): Promise<RecommendationRecord | null>;
  savePlannerOutput(record: RecommendationPlannerRecord): Promise<void>;
  saveExplainerOutput(record: RecommendationExplainerRecord): Promise<void>;
  findPlannerOutputByRecommendationId(
    recommendationId: string
  ): Promise<RecommendationPlannerRecord | null>;
  findExplainerOutputByRecommendationId(
    recommendationId: string
  ): Promise<RecommendationExplainerRecord | null>;
}

export interface RecommendationPromptTemplateRepository
  extends RecommendationPromptTemplateStore {}

export * from "./mappers";
export * from "./repository-adapters";
