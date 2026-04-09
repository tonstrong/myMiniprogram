import type {
  BaseRecord,
  CreatedAtRecord,
  JsonValue,
  ProviderModelFields
} from "../../../app/common/persistence";

export type StylePackStatus =
  | "draft"
  | "needs_confirm"
  | "active"
  | "inactive"
  | "failed";

export type StylePackSourceType = "text" | "video";

export interface StylePackRecord extends BaseRecord, ProviderModelFields {
  userId: string;
  name: string;
  sourceType: StylePackSourceType;
  sourceFileUrl?: string | null;
  transcriptText?: string | null;
  summaryText?: string | null;
  rulesJson?: JsonValue | null;
  promptProfile?: JsonValue | null;
  version: number;
  status: StylePackStatus;
  activatedAt?: Date | null;
}

export type StylePackRuleSource = "llm" | "user" | "system";

export interface StylePackRuleVersionRecord extends CreatedAtRecord {
  id: string;
  stylePackId: string;
  versionNo: number;
  summaryText?: string | null;
  rulesJson: JsonValue;
  promptProfile?: JsonValue | null;
  source: StylePackRuleSource;
}
