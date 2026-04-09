import type {
  BaseRecord,
  CreatedAtRecord,
  JsonValue,
  RetryableProviderFields
} from "../../../app/common/persistence";

export type ClothingItemStatus =
  | "pending_review"
  | "active"
  | "archived"
  | "deleted";

export type ClothingSourceType = "camera" | "album" | "import";

export interface ClothingItemRecord extends BaseRecord, RetryableProviderFields {
  userId: string;
  imageOriginalUrl: string;
  category?: string | null;
  subCategory?: string | null;
  colors?: JsonValue | null;
  pattern?: string | null;
  material?: string | null;
  fit?: JsonValue | null;
  length?: string | null;
  seasons?: JsonValue | null;
  tags?: JsonValue | null;
  occasionTags?: JsonValue | null;
  llmConfidence?: JsonValue | null;
  status: ClothingItemStatus;
  sourceType?: ClothingSourceType | null;
  confirmedAt?: Date | null;
}

export type ClothingAttributeSource = "llm" | "user" | "system";

export interface ClothingItemAttributeHistoryRecord extends CreatedAtRecord {
  id: string;
  itemId: string;
  versionNo: number;
  source: ClothingAttributeSource;
  attributesSnapshot: JsonValue;
  changedFields?: JsonValue | null;
  operatorId?: string | null;
}
