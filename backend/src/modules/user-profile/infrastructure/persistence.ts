import type { BaseRecord, JsonValue } from "../../../app/common/persistence";

export type UserStatus = "active" | "inactive";

export interface UserRecord extends BaseRecord {
  wechatOpenId: string;
  unionId?: string | null;
  nickname: string;
  avatarUrl?: string | null;
  status: UserStatus;
}

export interface UserPreferenceRecord extends BaseRecord {
  userId: string;
  stylePreferences?: JsonValue | null;
  bodyPreferences?: JsonValue | null;
  city?: string | null;
  temperatureSensitivity?: string | null;
}
