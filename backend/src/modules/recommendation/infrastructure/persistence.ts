import type {
  BaseRecord,
  CreatedAtRecord,
  JsonValue,
  RetryableProviderFields
} from "../../../app/common/persistence";

export type RecommendationStatus = "generated" | "validated" | "failed" | "saved";

export interface RecommendationRecord extends BaseRecord, RetryableProviderFields {
  userId: string;
  stylePackId: string;
  scene: string;
  weatherJson?: JsonValue | null;
  validatorResult?: JsonValue | null;
  reasonText?: string | null;
  status: RecommendationStatus;
}

export interface RecommendationItemRecord extends CreatedAtRecord {
  id: string;
  recommendationId: string;
  outfitNo: number;
  itemId: string;
  role: string;
  alternativeJson?: JsonValue | null;
}

export type RecommendationFeedbackAction = "like" | "dislike" | "save";

export interface RecommendationFeedbackRecord extends CreatedAtRecord {
  id: string;
  recommendationId: string;
  userId: string;
  action: RecommendationFeedbackAction;
  reasonTags?: JsonValue | null;
  comment?: string | null;
}
