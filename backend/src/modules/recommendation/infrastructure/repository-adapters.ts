import type { RecommendationRepository } from "./index";
import type {
  RecommendationExplainerRecord,
  RecommendationFeedbackRecord,
  RecommendationItemRecord,
  RecommendationPlannerRecord,
  RecommendationRecord
} from "./persistence";

export class InMemoryRecommendationRepository
  implements RecommendationRepository
{
  private recommendations = new Map<string, RecommendationRecord>();
  private items: RecommendationItemRecord[] = [];
  private feedback: RecommendationFeedbackRecord[] = [];
  private plannerOutputs = new Map<string, RecommendationPlannerRecord>();
  private explainerOutputs = new Map<string, RecommendationExplainerRecord>();

  async saveRecommendation(record: RecommendationRecord): Promise<void> {
    this.recommendations.set(record.id, record);
  }

  async saveRecommendationItems(
    items: RecommendationItemRecord[]
  ): Promise<void> {
    this.items.push(...items);
  }

  async saveFeedback(record: RecommendationFeedbackRecord): Promise<void> {
    this.feedback.push(record);
  }

  async findById(id: string): Promise<RecommendationRecord | null> {
    return this.recommendations.get(id) ?? null;
  }

  async savePlannerOutput(record: RecommendationPlannerRecord): Promise<void> {
    this.plannerOutputs.set(record.recommendationId, record);
  }

  async saveExplainerOutput(
    record: RecommendationExplainerRecord
  ): Promise<void> {
    this.explainerOutputs.set(record.recommendationId, record);
  }

  async findPlannerOutputByRecommendationId(
    recommendationId: string
  ): Promise<RecommendationPlannerRecord | null> {
    return this.plannerOutputs.get(recommendationId) ?? null;
  }

  async findExplainerOutputByRecommendationId(
    recommendationId: string
  ): Promise<RecommendationExplainerRecord | null> {
    return this.explainerOutputs.get(recommendationId) ?? null;
  }
}

export const createInMemoryRecommendationRepository =
  (): RecommendationRepository => new InMemoryRecommendationRepository();

export const createNoopRecommendationRepository =
  (): RecommendationRepository => ({
    async saveRecommendation() {
      return undefined;
    },
    async saveRecommendationItems() {
      return undefined;
    },
    async saveFeedback() {
      return undefined;
    },
    async findById() {
      return null;
    },
    async savePlannerOutput() {
      return undefined;
    },
    async saveExplainerOutput() {
      return undefined;
    },
    async findPlannerOutputByRecommendationId() {
      return null;
    },
    async findExplainerOutputByRecommendationId() {
      return null;
    }
  });
