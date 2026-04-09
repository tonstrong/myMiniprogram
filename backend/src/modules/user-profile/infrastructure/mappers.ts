import type { JsonValue } from "../../../app/common/persistence";
import type {
  UpdateUserProfileCommand,
  UserProfileSnapshot
} from "../application";
import type { UserPreferenceRecord, UserRecord } from "./persistence";

const coerceStringArray = (value?: JsonValue | null): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

export const mapUserProfileRecordsToSnapshot = (
  user: UserRecord,
  preferences?: UserPreferenceRecord | null
): UserProfileSnapshot => ({
  userId: user.id,
  nickname: user.nickname ?? undefined,
  avatarUrl: user.avatarUrl ?? undefined,
  stylePreferences: coerceStringArray(preferences?.stylePreferences),
  bodyPreferences: coerceStringArray(preferences?.bodyPreferences),
  city: preferences?.city ?? undefined,
  defaultTemperatureSensitivity: preferences?.temperatureSensitivity ?? undefined
});

export const mapUpdateUserProfileCommandToRecordPatch = (
  command: UpdateUserProfileCommand
): {
  userPatch: Partial<UserRecord>;
  preferencePatch: Partial<UserPreferenceRecord>;
} => ({
  userPatch: {
    id: command.userId,
    nickname: command.nickname,
    avatarUrl: command.avatarUrl
  },
  preferencePatch: {
    userId: command.userId,
    stylePreferences: command.stylePreferences,
    bodyPreferences: command.bodyPreferences,
    city: command.city,
    temperatureSensitivity: command.defaultTemperatureSensitivity
  }
});
