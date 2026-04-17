import type {
  BaseRecord,
  CreatedAtRecord,
  JsonValue,
  RetryableProviderFields
} from "../../../app/common/persistence";

export type RecommendationStatus =
  | "processing"
  | "generated"
  | "validated"
  | "failed"
  | "saved";

export type RecommendationSourceType = "manual" | "daily_home";

export interface RecommendationRecord extends BaseRecord, RetryableProviderFields {
  userId: string;
  stylePackId?: string | null;
  scene: string;
  sourceType: RecommendationSourceType;
  displayDate?: string | null;
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
  reasonText?: string | null;
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

export interface RecommendationListRecord {
  id: string;
  userId: string;
  scene: string;
  status: RecommendationStatus;
  createdAt: Date;
  updatedAt: Date;
  coverImageUrl?: string | null;
}

export interface RecommendationHomeCardRecord {
  id: string;
  userId: string;
  scene: string;
  sourceType: RecommendationSourceType;
  displayDate?: string | null;
  status: RecommendationStatus;
  reasonText?: string | null;
  createdAt: Date;
  updatedAt: Date;
  coverImageUrl?: string | null;
}

export type RecommendationArtifactStatus = "generated" | "failed" | "pending";

export interface RecommendationPlannerRecord
  extends BaseRecord,
    RetryableProviderFields {
  recommendationId: string;
  planJson?: JsonValue | null;
  status: RecommendationArtifactStatus;
}

export interface RecommendationExplainerRecord
  extends BaseRecord,
    RetryableProviderFields {
  recommendationId: string;
  explanationText?: string | null;
  explanationJson?: JsonValue | null;
  status: RecommendationArtifactStatus;
}
