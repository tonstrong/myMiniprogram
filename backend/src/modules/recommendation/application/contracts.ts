import type {
  RecommendationCandidateFilterInput,
  RecommendationCandidateFilterResult,
  RecommendationCandidateProviderInput,
  RecommendationCandidateItem,
  RecommendationExplainerInput,
  RecommendationExplainerResult,
  RecommendationPlannerInput,
  RecommendationPlannerResult,
  RecommendationPromptTemplateDescriptor,
  RecommendationPromptBuildResult,
  RecommendationValidationInput,
  RecommendationValidationResult
} from "./types";

export interface RecommendationCandidateProvider {
  fetchCandidates(
    input: RecommendationCandidateProviderInput
  ): Promise<RecommendationCandidateItem[]>;
}

export interface RecommendationCandidateFilter {
  filter(
    input: RecommendationCandidateFilterInput
  ): Promise<RecommendationCandidateFilterResult>;
}

export interface RecommendationPlanner {
  plan(input: RecommendationPlannerInput): Promise<RecommendationPlannerResult>;
}

export interface RecommendationValidator {
  validate(
    input: RecommendationValidationInput
  ): Promise<RecommendationValidationResult>;
}

export interface RecommendationExplainer {
  explain(
    input: RecommendationExplainerInput
  ): Promise<RecommendationExplainerResult>;
}

export interface RecommendationPromptTemplateProvider {
  getPlannerTemplate(): RecommendationPromptTemplateDescriptor;
  getExplainerTemplate(): RecommendationPromptTemplateDescriptor;
}

export interface RecommendationPromptSchemaProvider {
  getPlannerOutputSchema(): Record<string, unknown>;
  getExplainerOutputSchema(): Record<string, unknown>;
}

export interface RecommendationPlannerPromptBuilder {
  build(input: RecommendationPlannerInput): RecommendationPromptBuildResult;
}

export interface RecommendationExplainerPromptBuilder {
  build(input: RecommendationExplainerInput): RecommendationPromptBuildResult;
}
