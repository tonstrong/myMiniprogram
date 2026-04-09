import type { ProviderMeta } from "../../../app/common/types";

export type LlmTaskType =
  | "extract_clothing_attributes"
  | "extract_style_pack"
  | "generate_outfit_recommendations"
  | "recommendation_planner"
  | "recommendation_explainer";

export interface LlmGatewayRequest {
  taskType: LlmTaskType;
  input: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  providerHint?: string;
  modelTier?: string;
  timeoutMs?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffMs?: number;
  };
}

export interface LlmGatewayResponse {
  output: Record<string, unknown>;
  providerMeta: ProviderMeta;
  rawText?: string;
}

export interface ProviderRoutingPolicy {
  primaryProvider?: string;
  fallbackProviders?: string[];
  modelTier?: string;
  timeoutMs?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffMs?: number;
  };
}

export interface LlmGatewayService {
  invoke(request: LlmGatewayRequest): Promise<LlmGatewayResponse>;
}
