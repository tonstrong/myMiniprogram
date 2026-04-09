export interface RecommendationRepository {
  save(plan: unknown): Promise<void>;
}
