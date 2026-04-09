import type { JsonValue } from "../../../app/common/persistence";
import type { ProviderRoutingPolicy } from "../application";
import type { ProviderConfigRecord } from "./persistence";

const coerceStringArray = (value?: JsonValue | null): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

export const mapProviderConfigRecordToRoutingPolicy = (
  record: ProviderConfigRecord
): ProviderRoutingPolicy => ({
  primaryProvider: record.primaryProvider,
  fallbackProviders: coerceStringArray(record.fallbackProviders),
  modelTier: record.tier,
  timeoutMs: record.timeoutMs,
  retryPolicy: record.retryPolicy as ProviderRoutingPolicy["retryPolicy"]
});
