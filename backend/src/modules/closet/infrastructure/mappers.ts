import type { JsonValue, RetryableProviderFields } from "../../../app/common/persistence";
import type { ProviderMeta } from "../../../app/common/types";
import type {
  ClothingAttributes,
  ClothingItemDetail,
  ClothingItemStatus,
  ClothingItemSummary
} from "../application";
import type { ClothingItemRecord } from "./persistence";

const coerceStringArray = (value?: JsonValue | null): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const coerceNumberRecord = (
  value?: JsonValue | null
): Record<string, number> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const result: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "number") {
      result[key] = entry;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

const mapClothingStatus = (
  status: ClothingItemRecord["status"]
): ClothingItemStatus => {
  switch (status) {
    case "pending_review":
      return "needs_review";
    case "active":
      return "active";
    case "archived":
      return "archived";
    case "deleted":
      return "deleted";
    default:
      return "needs_review";
  }
};

const buildProviderMeta = (
  record: RetryableProviderFields
): ProviderMeta | undefined => {
  const hasAny =
    record.provider || record.modelName || record.modelTier || record.retryCount;
  if (!hasAny) {
    return undefined;
  }
  return {
    provider: record.provider ?? "unknown",
    modelName: record.modelName ?? undefined,
    modelTier: record.modelTier ?? undefined,
    retryCount: record.retryCount ?? undefined
  };
};

export const mapClothingRecordToSummary = (
  record: ClothingItemRecord
): ClothingItemSummary => ({
  itemId: record.id,
  category: record.category ?? undefined,
  subCategory: record.subCategory ?? undefined,
  colors: coerceStringArray(record.colors),
  tags: coerceStringArray(record.tags),
  status: mapClothingStatus(record.status),
  imageOriginalUrl: record.imageOriginalUrl ?? undefined,
  updatedAt: record.updatedAt?.toISOString()
});

export const mapClothingRecordToDetail = (
  record: ClothingItemRecord
): ClothingItemDetail => {
  const attributes: ClothingAttributes = {
    category: record.category ?? undefined,
    subCategory: record.subCategory ?? undefined,
    colors: coerceStringArray(record.colors),
    pattern: record.pattern ?? undefined,
    material: record.material ?? undefined,
    fit: coerceStringArray(record.fit),
    length: record.length ?? undefined,
    seasons: coerceStringArray(record.seasons),
    tags: coerceStringArray(record.tags),
    occasionTags: coerceStringArray(record.occasionTags),
    confidence: coerceNumberRecord(record.llmConfidence)
  };

  return {
    itemId: record.id,
    status: mapClothingStatus(record.status),
    imageOriginalUrl: record.imageOriginalUrl ?? undefined,
    attributes,
    providerMeta: buildProviderMeta(record)
  };
};
