export interface LlmProviderAdapter {
  name: string;
  call: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
}

import type {
  ModelInvocationLogRecord,
  ProviderConfigRecord
} from "./persistence";

export interface ModelInvocationLogRepository {
  save(record: ModelInvocationLogRecord): Promise<void>;
}

export interface ProviderConfigRepository {
  findActiveByTaskType(taskType: string): Promise<ProviderConfigRecord | null>;
}

export * from "./mappers";
export * from "./repository-adapters";
export { OpenAIAdapter } from "./adapters/openai-adapter";
