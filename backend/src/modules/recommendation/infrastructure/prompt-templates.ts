export interface RecommendationPromptTemplate {
  templateId: string;
  version: string;
  systemPrompt?: string;
  developerPrompt?: string;
  description?: string;
  updatedAt?: string;
}

export interface RecommendationPromptTemplateStore {
  getTemplate(
    templateId: string,
    version?: string
  ): Promise<RecommendationPromptTemplate | null>;
}
