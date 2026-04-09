import type {
  CreatedAtRecord,
  JsonValue,
  ProviderModelFields
} from "../../../app/common/persistence";

export type ModelInvocationParseStatus = "success" | "failed";

export interface ModelInvocationLogRecord
  extends CreatedAtRecord,
    ProviderModelFields {
  id: string;
  taskId: string;
  requestSchema?: JsonValue | null;
  responseSchema?: JsonValue | null;
  parseStatus: ModelInvocationParseStatus;
  latencyMs?: number | null;
  tokenUsage?: JsonValue | null;
  fallbackUsed: boolean;
}

export type ProviderConfigStatus = "active" | "inactive";

export interface ProviderConfigRecord {
  id: string;
  taskType: string;
  primaryProvider: string;
  fallbackProviders?: JsonValue | null;
  tier: string;
  timeoutMs: number;
  retryPolicy?: JsonValue | null;
  status: ProviderConfigStatus;
  createdAt: Date;
  updatedAt: Date;
}
