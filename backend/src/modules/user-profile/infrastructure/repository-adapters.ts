import type { RowDataPacket } from "mysql2/promise";
import { withClient } from "../../../app/db";
import type { JsonValue } from "../../../app/common/persistence";
import type { UserProfileRepository } from "./index";
import type { UserPreferenceRecord, UserRecord } from "./persistence";

export class InMemoryUserProfileRepository implements UserProfileRepository {
  private users = new Map<string, UserRecord>();
  private preferences = new Map<string, UserPreferenceRecord>();

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async saveUser(user: UserRecord): Promise<void> {
    this.users.set(user.id, user);
  }

  async savePreferences(preferences: UserPreferenceRecord): Promise<void> {
    this.preferences.set(preferences.userId, preferences);
  }

  async findPreferencesByUserId(
    userId: string
  ): Promise<UserPreferenceRecord | null> {
    return this.preferences.get(userId) ?? null;
  }
}

export const createInMemoryUserProfileRepository = (): UserProfileRepository =>
  new InMemoryUserProfileRepository();

interface UserRow extends RowDataPacket {
  id: string;
  wechat_open_id: string;
  union_id: string | null;
  nickname: string;
  avatar_url: string | null;
  status: UserRecord["status"];
  created_at: Date | string;
  updated_at: Date | string;
}

interface UserPreferenceRow extends RowDataPacket {
  id: string;
  user_id: string;
  style_preferences: string | JsonValue[] | null;
  body_preferences: string | JsonValue[] | null;
  city: string | null;
  temperature_sensitivity: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export class MySqlUserProfileRepository implements UserProfileRepository {
  async findById(id: string): Promise<UserRecord | null> {
    return withClient(async (client) => {
      const [rows] = await client.query<UserRow[]>(
        `SELECT id, wechat_open_id, union_id, nickname, avatar_url, status, created_at, updated_at
         FROM users
         WHERE id = ?
         LIMIT 1`,
        [id]
      );
      const row = rows[0];
      return row
        ? {
            id: row.id,
            wechatOpenId: row.wechat_open_id,
            unionId: row.union_id,
            nickname: row.nickname,
            avatarUrl: row.avatar_url,
            status: row.status,
            createdAt: toDate(row.created_at),
            updatedAt: toDate(row.updated_at)
          }
        : null;
    });
  }

  async saveUser(user: UserRecord): Promise<void> {
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO users (
          id,
          wechat_open_id,
          union_id,
          nickname,
          avatar_url,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          wechat_open_id = VALUES(wechat_open_id),
          union_id = VALUES(union_id),
          nickname = VALUES(nickname),
          avatar_url = VALUES(avatar_url),
          status = VALUES(status),
          updated_at = VALUES(updated_at)`,
        [
          user.id,
          user.wechatOpenId,
          user.unionId ?? null,
          user.nickname,
          user.avatarUrl ?? null,
          user.status,
          formatDateTime(user.createdAt),
          formatDateTime(user.updatedAt)
        ]
      );
    });
  }

  async savePreferences(preferences: UserPreferenceRecord): Promise<void> {
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO user_preferences (
          id,
          user_id,
          style_preferences,
          body_preferences,
          city,
          temperature_sensitivity,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          style_preferences = VALUES(style_preferences),
          body_preferences = VALUES(body_preferences),
          city = VALUES(city),
          temperature_sensitivity = VALUES(temperature_sensitivity),
          updated_at = VALUES(updated_at)`,
        [
          preferences.id,
          preferences.userId,
          encodeJson(preferences.stylePreferences),
          encodeJson(preferences.bodyPreferences),
          preferences.city ?? null,
          preferences.temperatureSensitivity ?? null,
          formatDateTime(preferences.createdAt),
          formatDateTime(preferences.updatedAt)
        ]
      );
    });
  }

  async findPreferencesByUserId(
    userId: string
  ): Promise<UserPreferenceRecord | null> {
    return withClient(async (client) => {
      const [rows] = await client.query<UserPreferenceRow[]>(
        `SELECT id, user_id, style_preferences, body_preferences, city,
                temperature_sensitivity, created_at, updated_at
         FROM user_preferences
         WHERE user_id = ?
         LIMIT 1`,
        [userId]
      );
      const row = rows[0];
      return row
        ? {
            id: row.id,
            userId: row.user_id,
            stylePreferences: decodeJson(row.style_preferences),
            bodyPreferences: decodeJson(row.body_preferences),
            city: row.city,
            temperatureSensitivity: row.temperature_sensitivity,
            createdAt: toDate(row.created_at),
            updatedAt: toDate(row.updated_at)
          }
        : null;
    });
  }
}

export const createMySqlUserProfileRepository = (): UserProfileRepository =>
  new MySqlUserProfileRepository();

export const createNoopUserProfileRepository = (): UserProfileRepository => ({
  async findById() {
    return null;
  },
  async saveUser() {
    return undefined;
  },
  async savePreferences() {
    return undefined;
  },
  async findPreferencesByUserId() {
    return null;
  }
});

function encodeJson(value?: JsonValue | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return JSON.stringify(value);
}

function decodeJson(value: unknown): JsonValue | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string") {
    return JSON.parse(value) as JsonValue;
  }
  return value as JsonValue;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function formatDateTime(value: Date): string {
  return value.toISOString().slice(0, 19).replace("T", " ");
}
