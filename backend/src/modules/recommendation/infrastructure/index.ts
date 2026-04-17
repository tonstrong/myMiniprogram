import type {
  RecommendationExplainerRecord,
  RecommendationFeedbackRecord,
  RecommendationHomeCardRecord,
  RecommendationItemRecord,
  RecommendationListRecord,
  RecommendationPlannerRecord,
  RecommendationRecord
} from "./persistence";
import type { RecommendationPromptTemplateStore } from "./prompt-templates";

export interface RecommendationRepository {
  saveRecommendation(record: RecommendationRecord): Promise<void>;
  updateRecommendation(id: string, patch: Partial<RecommendationRecord>): Promise<void>;
  replaceRecommendationItems(
    recommendationId: string,
    items: RecommendationItemRecord[]
  ): Promise<void>;
  findItemsByRecommendationId(
    recommendationId: string
  ): Promise<RecommendationItemRecord[]>;
  listByUser(
    userId: string,
    query: { savedOnly?: boolean; pageNo: number; pageSize: number }
  ): Promise<{ items: RecommendationListRecord[]; total: number }>;
  saveFeedback(record: RecommendationFeedbackRecord): Promise<void>;
  findById(id: string): Promise<RecommendationRecord | null>;
  countCreatedByUserSince(userId: string, since: Date): Promise<number>;
  findDailyHomeByUserAndDate(
    userId: string,
    displayDate: string
  ): Promise<RecommendationHomeCardRecord | null>;
  listPreferredItemIds(userId: string, limit: number): Promise<string[]>;
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
