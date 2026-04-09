import type { LlmGatewayRequest } from "../../llm-gateway/application";
import type {
  RecommendationExplainerInput,
  RecommendationExplainerPromptPayload,
  RecommendationPlannerInput,
  RecommendationPlannerPromptPayload,
  RecommendationPromptBuildResult
} from "./types";
import type {
  RecommendationExplainerPromptBuilder,
  RecommendationPlannerPromptBuilder,
  RecommendationPromptSchemaProvider,
  RecommendationPromptTemplateProvider
} from "./contracts";

export class DefaultRecommendationPlannerPromptBuilder
  implements RecommendationPlannerPromptBuilder
{
  constructor(
    private readonly templateProvider: RecommendationPromptTemplateProvider,
    private readonly schemaProvider?: RecommendationPromptSchemaProvider
  ) {}

  build(input: RecommendationPlannerInput): RecommendationPromptBuildResult {
    const template = this.templateProvider.getPlannerTemplate();
    const payload: RecommendationPlannerPromptPayload = {
      scene: input.scene,
      weather: input.weather,
      user_profile: input.userProfile,
      style_pack: input.stylePack,
      wardrobe_candidates: input.candidates.map((candidate) => ({
        item_id: candidate.itemId,
        category: candidate.category,
        sub_category: candidate.subCategory,
        colors: candidate.colors,
        tags: candidate.tags
      }))
    };

    const request: LlmGatewayRequest = {
      taskType: "recommendation_planner",
      input: {
        promptTemplateId: template.templateId,
        promptVersion: template.version,
        payload
      },
      outputSchema: this.schemaProvider?.getPlannerOutputSchema()
    };

    return {
      request,
      promptVersion: template.version
    };
  }
}

export class DefaultRecommendationExplainerPromptBuilder
  implements RecommendationExplainerPromptBuilder
{
  constructor(
    private readonly templateProvider: RecommendationPromptTemplateProvider,
    private readonly schemaProvider?: RecommendationPromptSchemaProvider
  ) {}

  build(input: RecommendationExplainerInput): RecommendationPromptBuildResult {
    const template = this.templateProvider.getExplainerTemplate();
    const payload: RecommendationExplainerPromptPayload = {
      scene: input.scene,
      weather: input.weather,
      user_profile: input.userProfile,
      style_pack: input.stylePack,
      outfits: input.outfits.map((outfit) => ({
        outfit_no: outfit.outfitNo,
        items: outfit.items.map((item) => ({
          item_id: item.itemId,
          role: item.role
        }))
      }))
    };

    const request: LlmGatewayRequest = {
      taskType: "recommendation_explainer",
      input: {
        promptTemplateId: template.templateId,
        promptVersion: template.version,
        payload
      },
      outputSchema: this.schemaProvider?.getExplainerOutputSchema()
    };

    return {
      request,
      promptVersion: template.version
    };
  }
}
