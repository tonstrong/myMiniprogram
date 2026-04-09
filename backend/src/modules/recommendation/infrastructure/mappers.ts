import type { JsonValue, RetryableProviderFields } from "../../../app/common/persistence";
import type { ProviderMeta } from "../../../app/common/types";
import type {
  RecommendationAlternative,
  RecommendationOutfit,
  RecommendationResult
} from "../application";
import type {
  RecommendationItemRecord,
  RecommendationRecord
} from "./persistence";

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

const coerceAlternatives = (
  value?: JsonValue | null
): RecommendationAlternative[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const alternatives = value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return null;
      }
      const data = entry as Record<string, JsonValue>;
      const replaceItemId =
        typeof data.replaceItemId === "string" ? data.replaceItemId : undefined;
      const withItemId =
        typeof data.withItemId === "string" ? data.withItemId : undefined;
      if (!replaceItemId || !withItemId) {
        return null;
      }
      const alternative: RecommendationAlternative = {
        replaceItemId,
        withItemId
      };
      if (typeof data.reason === "string") {
        alternative.reason = data.reason;
      }
      return alternative;
    })
    .filter((entry): entry is RecommendationAlternative => entry !== null);

  return alternatives.length > 0 ? alternatives : undefined;
};

export const mapRecommendationRecordsToResult = (
  recommendation: RecommendationRecord,
  items: RecommendationItemRecord[] = []
): RecommendationResult => {
  const outfitsByNo = new Map<number, RecommendationOutfit>();

  for (const item of items) {
    const outfit =
      outfitsByNo.get(item.outfitNo) ??
      ({ items: [] } satisfies RecommendationOutfit);
    outfit.items.push(item.itemId);
    const alternatives = coerceAlternatives(item.alternativeJson);
    if (alternatives) {
      outfit.alternatives = [...(outfit.alternatives ?? []), ...alternatives];
    }
    outfitsByNo.set(item.outfitNo, outfit);
  }

  const outfits = Array.from(outfitsByNo.entries())
    .sort(([left], [right]) => left - right)
    .map(([, outfit]) => outfit);

  return {
    recommendationId: recommendation.id,
    outfits,
    providerMeta: buildProviderMeta(recommendation),
    status: recommendation.status === "failed" ? "failed" : "completed",
    createdAt: recommendation.createdAt?.toISOString()
  };
};
