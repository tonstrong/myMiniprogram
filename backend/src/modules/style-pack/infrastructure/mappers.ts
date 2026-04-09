import type { JsonValue, ProviderModelFields } from "../../../app/common/persistence";
import type { ProviderMeta } from "../../../app/common/types";
import type { StylePackDetail, StylePackSummary } from "../application";
import type { StylePackRecord } from "./persistence";

const coerceObject = (
  value?: JsonValue | null
): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
};

const buildProviderMeta = (
  record: ProviderModelFields
): ProviderMeta | undefined => {
  const hasAny = record.provider || record.modelName || record.modelTier;
  if (!hasAny) {
    return undefined;
  }
  return {
    provider: record.provider ?? "unknown",
    modelName: record.modelName ?? undefined,
    modelTier: record.modelTier ?? undefined
  };
};

export const mapStylePackRecordToSummary = (
  record: StylePackRecord
): StylePackSummary => ({
  stylePackId: record.id,
  name: record.name,
  sourceType: record.sourceType,
  status: record.status,
  version: record.version,
  updatedAt: record.updatedAt?.toISOString()
});

export const mapStylePackRecordToDetail = (
  record: StylePackRecord
): StylePackDetail => ({
  ...mapStylePackRecordToSummary(record),
  summaryText: record.summaryText ?? undefined,
  rulesJson: coerceObject(record.rulesJson),
  promptProfile: coerceObject(record.promptProfile),
  providerMeta: buildProviderMeta(record),
  transcriptText: record.transcriptText ?? undefined
});
