import type { ProviderMeta } from "../../../app/common/types";

export type LlmTaskTypeDTO =
  | "extract_clothing_attributes"
  | "extract_style_pack"
  | "generate_outfit_recommendations"
  | "recommendation_planner"
  | "recommendation_explainer";

export interface LlmGatewayInvokeRequestDTO {
  taskType: LlmTaskTypeDTO;
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

export interface LlmGatewayInvokeResponseDTO {
  output: Record<string, unknown>;
  providerMeta: ProviderMeta;
  rawText?: string;
}
