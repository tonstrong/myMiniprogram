import type {
  UserPreferenceRecord,
  UserRecord
} from "./persistence";

export interface UserProfileRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByWechatOpenId(wechatOpenId: string): Promise<UserRecord | null>;
  saveUser(user: UserRecord): Promise<void>;
  savePreferences(preferences: UserPreferenceRecord): Promise<void>;
  findPreferencesByUserId(userId: string): Promise<UserPreferenceRecord | null>;
  listActiveUserIds(): Promise<string[]>;
}

export * from "./mappers";
export * from "./repository-adapters";
