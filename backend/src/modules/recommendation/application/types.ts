import type { ProviderMeta } from "../../../app/common/types";
import type { LlmGatewayRequest } from "../../llm-gateway/application";

export interface RecommendationWeather {
  temperature: number;
  condition: string;
}

export interface RecommendationUserProfile {
  stylePreferences?: string[];
  bodyPreferences?: string[];
}

export interface RecommendationStylePackContext {
  summary?: string;
  rules?: Record<string, unknown>;
  promptProfile?: {
    tone?: string;
    bias?: string[];
  };
}

export interface RecommendationCandidateItem {
  itemId: string;
  category: string;
  subCategory?: string;
  colors?: string[];
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface RecommendationOutfitItem {
  itemId: string;
  role: string;
}

export interface RecommendationOutfitAlternative {
  replaceItemId: string;
  withItemId: string;
  reason?: string;
}

export interface RecommendationOutfitPlan {
  outfitNo: number;
  items: RecommendationOutfitItem[];
  alternatives?: RecommendationOutfitAlternative[];
  reason?: string;
}

export interface RecommendationPlannerInput {
  requestId?: string;
  userId: string;
  scene: string;
  weather?: RecommendationWeather;
  stylePack?: RecommendationStylePackContext;
  userProfile?: RecommendationUserProfile;
  preferenceTags?: string[];
  candidates: RecommendationCandidateItem[];
}

export interface RecommendationPlannerSuccessResult {
  status: "success";
  outfits: RecommendationOutfitPlan[];
  meta?: Record<string, unknown>;
  promptVersion?: string;
  providerMeta?: ProviderMeta;
}

export interface RecommendationPlannerInsufficientResult {
  status: "insufficient_items";
  reason?: string;
  promptVersion?: string;
  providerMeta?: ProviderMeta;
}

export type RecommendationPlannerResult =
  | RecommendationPlannerSuccessResult
  | RecommendationPlannerInsufficientResult;

export interface RecommendationValidationError {
  code:
    | "missing_item"
    | "missing_category"
    | "invalid_alternative"
    | "insufficient_items"
    | "rule_conflict"
    | "unknown";
  message: string;
  itemId?: string;
  outfitNo?: number;
  context?: Record<string, unknown>;
}

export interface RecommendationValidationWarning {
  code: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface RecommendationValidationInput {
  candidates: RecommendationCandidateItem[];
  outfits: RecommendationOutfitPlan[];
  scene?: string;
  weather?: RecommendationWeather;
  stylePack?: RecommendationStylePackContext;
}

export interface RecommendationValidationResult {
  status: "passed" | "failed";
  errors?: RecommendationValidationError[];
  warnings?: RecommendationValidationWarning[];
  validatedOutfits?: RecommendationOutfitPlan[];
  ruleVersion?: string;
}

export interface RecommendationExplainerInput {
  requestId?: string;
  userId: string;
  scene: string;
  weather?: RecommendationWeather;
  stylePack?: RecommendationStylePackContext;
  userProfile?: RecommendationUserProfile;
  outfits: RecommendationOutfitPlan[];
}

export interface RecommendationExplainerSuccessResult {
  status: "success";
  outfits: RecommendationOutfitPlan[];
  meta?: Record<string, unknown>;
  promptVersion?: string;
  providerMeta?: ProviderMeta;
}

export interface RecommendationExplainerFailedResult {
  status: "failed";
  reason?: string;
  promptVersion?: string;
  providerMeta?: ProviderMeta;
}

export type RecommendationExplainerResult =
  | RecommendationExplainerSuccessResult
  | RecommendationExplainerFailedResult;

export interface RecommendationCandidateProviderInput {
  userId: string;
  scene: string;
  weather?: RecommendationWeather;
  stylePackId?: string;
  preferenceTags?: string[];
}

export interface RecommendationCandidateFilterInput {
  userId: string;
  scene: string;
  weather?: RecommendationWeather;
  stylePack?: RecommendationStylePackContext;
  preferenceTags?: string[];
  candidates: RecommendationCandidateItem[];
}

export interface RecommendationCandidateFilterResult {
  status: "ok" | "insufficient_items";
  candidates: RecommendationCandidateItem[];
  reason?: string;
}

export interface RecommendationPromptTemplateDescriptor {
  templateId: string;
  version: string;
}

export interface RecommendationPlannerPromptPayload {
  scene: string;
  weather?: RecommendationWeather;
  user_profile?: RecommendationUserProfile;
  style_pack?: RecommendationStylePackContext;
  wardrobe_candidates: Array<{
    item_id: string;
    category: string;
    sub_category?: string;
    colors?: string[];
    tags?: string[];
  }>;
}

export interface RecommendationExplainerPromptPayload {
  scene: string;
  weather?: RecommendationWeather;
  user_profile?: RecommendationUserProfile;
  style_pack?: RecommendationStylePackContext;
  outfits: Array<{
    outfit_no: number;
    items: Array<{
      item_id: string;
      role: string;
    }>;
  }>;
}

export interface RecommendationPromptBuildResult {
  request: LlmGatewayRequest;
  promptVersion: string;
}

export interface RecommendationOrchestrationResult {
  status:
    | "completed"
    | "insufficient_items"
    | "validation_failed"
    | "failed";
  stage?:
    | "candidate_gathering"
    | "candidate_filter"
    | "planner"
    | "validator"
    | "explainer";
  outfits?: RecommendationOutfitPlan[];
  validation?: RecommendationValidationResult;
  reason?: string;
  providerMeta?: {
    planner?: ProviderMeta;
    explainer?: ProviderMeta;
  };
}
