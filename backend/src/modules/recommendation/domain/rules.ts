export type RecommendationRuleVersion = string;

export interface RecommendationCategoryRequirement {
  category: string;
  minimumCount: number;
  optional?: boolean;
}

export interface RecommendationRuleSet {
  version: RecommendationRuleVersion;
  requiredCategories: RecommendationCategoryRequirement[];
  allowAlternatives: boolean;
  notes?: string;
}
