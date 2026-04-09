import type { JsonValue } from "../../../app/common/persistence";
import type { ProviderMeta } from "../../../app/common/types";
import type {
  TaskStatusSnapshot,
  UpdateTaskStatusCommand
} from "../application";
import type { AsyncTaskRecord } from "./persistence";

const coerceProviderMeta = (value?: JsonValue | null): ProviderMeta | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const data = value as Record<string, JsonValue>;
  if (typeof data.provider !== "string") {
    return undefined;
  }
  return {
    provider: data.provider,
    modelName: typeof data.modelName === "string" ? data.modelName : undefined,
    modelTier: typeof data.modelTier === "string" ? data.modelTier : undefined,
    retryCount: typeof data.retryCount === "number" ? data.retryCount : undefined,
    fallbackUsed:
      typeof data.fallbackUsed === "boolean" ? data.fallbackUsed : undefined,
    latencyMs: typeof data.latencyMs === "number" ? data.latencyMs : undefined
  };
};

const mapProviderMetaToJson = (
  meta?: ProviderMeta
): JsonValue | undefined => {
  if (!meta) {
    return undefined;
  }
  const payload: Record<string, JsonValue> = {
    provider: meta.provider
  };
  if (meta.modelName) {
    payload.modelName = meta.modelName;
  }
  if (meta.modelTier) {
    payload.modelTier = meta.modelTier;
  }
  if (meta.retryCount !== undefined) {
    payload.retryCount = meta.retryCount;
  }
  if (meta.fallbackUsed !== undefined) {
    payload.fallbackUsed = meta.fallbackUsed;
  }
  if (meta.latencyMs !== undefined) {
    payload.latencyMs = meta.latencyMs;
  }
  return payload;
};

export const mapAsyncTaskRecordToSnapshot = (
  record: AsyncTaskRecord
): TaskStatusSnapshot => ({
  taskId: record.id,
  taskType: record.taskType,
  status: record.status,
  progress: record.progress,
  resultSummary: record.resultSummary ?? undefined,
  providerMeta: coerceProviderMeta(record.providerMeta)
});

export const mapUpdateTaskCommandToRecordPatch = (
  command: UpdateTaskStatusCommand
): Partial<AsyncTaskRecord> => ({
  status: command.status,
  progress: command.progress,
  resultSummary: command.resultSummary,
  providerMeta: mapProviderMetaToJson(command.providerMeta)
});
