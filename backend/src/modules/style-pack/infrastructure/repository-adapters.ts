import type { RowDataPacket } from "mysql2/promise";
import { withClient } from "../../../app/db";
import type { JsonValue } from "../../../app/common/persistence";
import type { StylePackRepository } from "./index";
import type { StylePackRecord, StylePackRuleVersionRecord } from "./persistence";

export class InMemoryStylePackRepository implements StylePackRepository {
  private stylePacks = new Map<string, StylePackRecord>();
  private ruleVersions = new Map<string, StylePackRuleVersionRecord[]>();

  async saveStylePack(record: StylePackRecord): Promise<void> {
    this.stylePacks.set(record.id, record);
  }

  async updateStylePack(
    id: string,
    patch: Partial<StylePackRecord>
  ): Promise<void> {
    const current = this.stylePacks.get(id);
    if (!current) {
      return undefined;
    }
    this.stylePacks.set(id, { ...current, ...patch });
  }

  async appendRuleVersion(record: StylePackRuleVersionRecord): Promise<void> {
    const existing = this.ruleVersions.get(record.stylePackId) ?? [];
    this.ruleVersions.set(record.stylePackId, [...existing, record]);
  }

  async findById(id: string): Promise<StylePackRecord | null> {
    return this.stylePacks.get(id) ?? null;
  }

  async listStylePacksByUserId(userId: string): Promise<StylePackRecord[]> {
    return Array.from(this.stylePacks.values()).filter(
      (record) => record.userId === userId
    );
  }
}

export const createInMemoryStylePackRepository = (): StylePackRepository =>
  new InMemoryStylePackRepository();

interface StylePackRow extends RowDataPacket {
  id: string;
  user_id: string;
  name: string;
  source_type: StylePackRecord["sourceType"];
  source_file_url: string | null;
  transcript_text: string | null;
  summary_text: string | null;
  rules_json: string | Record<string, JsonValue> | null;
  prompt_profile: string | Record<string, JsonValue> | null;
  provider: string | null;
  model_name: string | null;
  model_tier: string | null;
  version: number;
  status: StylePackRecord["status"];
  created_at: Date | string;
  updated_at: Date | string;
  activated_at: Date | string | null;
}

export class MySqlStylePackRepository implements StylePackRepository {
  async saveStylePack(record: StylePackRecord): Promise<void> {
    await withClient(async (client) => {
      await ensureUserExists(client, record.userId, record.createdAt);
      await client.query(
        `INSERT INTO style_packs (
          id,
          user_id,
          name,
          source_type,
          source_file_url,
          transcript_text,
          summary_text,
          rules_json,
          prompt_profile,
          provider,
          model_name,
          model_tier,
          version,
          status,
          created_at,
          updated_at,
          activated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.userId,
          record.name,
          record.sourceType,
          record.sourceFileUrl ?? null,
          record.transcriptText ?? null,
          record.summaryText ?? null,
          encodeJson(record.rulesJson),
          encodeJson(record.promptProfile),
          record.provider ?? null,
          record.modelName ?? null,
          record.modelTier ?? null,
          record.version,
          record.status,
          formatDateTime(record.createdAt),
          formatDateTime(record.updatedAt),
          formatOptionalDateTime(record.activatedAt)
        ]
      );
    });
  }

  async updateStylePack(
    id: string,
    patch: Partial<StylePackRecord>
  ): Promise<void> {
    const assignments: string[] = [];
    const values: unknown[] = [];

    pushAssignment(assignments, values, "name", patch.name);
    pushAssignment(assignments, values, "source_type", patch.sourceType);
    pushAssignment(assignments, values, "source_file_url", patch.sourceFileUrl);
    pushAssignment(assignments, values, "transcript_text", patch.transcriptText);
    pushAssignment(assignments, values, "summary_text", patch.summaryText);
    if (patch.rulesJson !== undefined) {
      assignments.push("rules_json = ?");
      values.push(encodeJson(patch.rulesJson));
    }
    if (patch.promptProfile !== undefined) {
      assignments.push("prompt_profile = ?");
      values.push(encodeJson(patch.promptProfile));
    }
    pushAssignment(assignments, values, "provider", patch.provider);
    pushAssignment(assignments, values, "model_name", patch.modelName);
    pushAssignment(assignments, values, "model_tier", patch.modelTier);
    if (patch.version !== undefined) {
      assignments.push("version = ?");
      values.push(patch.version);
    }
    pushAssignment(assignments, values, "status", patch.status);
    if (patch.updatedAt !== undefined) {
      assignments.push("updated_at = ?");
      values.push(formatDateTime(patch.updatedAt));
    }
    if (patch.activatedAt !== undefined) {
      assignments.push("activated_at = ?");
      values.push(formatOptionalDateTime(patch.activatedAt));
    }

    if (assignments.length === 0) {
      return;
    }

    values.push(id);
    await withClient(async (client) => {
      await client.query(
        `UPDATE style_packs SET ${assignments.join(", ")} WHERE id = ?`,
        values
      );
    });
  }

  async appendRuleVersion(record: StylePackRuleVersionRecord): Promise<void> {
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO style_pack_rule_versions (
          id,
          style_pack_id,
          version_no,
          summary_text,
          rules_json,
          prompt_profile,
          source,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.stylePackId,
          record.versionNo,
          record.summaryText ?? null,
          encodeRequiredJson(record.rulesJson),
          encodeJson(record.promptProfile),
          record.source,
          formatDateTime(record.createdAt)
        ]
      );
    });
  }

  async findById(id: string): Promise<StylePackRecord | null> {
    return withClient(async (client) => {
      const [rows] = await client.query<StylePackRow[]>(
        `SELECT
          id,
          user_id,
          name,
          source_type,
          source_file_url,
          transcript_text,
          summary_text,
          rules_json,
          prompt_profile,
          provider,
          model_name,
          model_tier,
          version,
          status,
          created_at,
          updated_at,
          activated_at
        FROM style_packs
        WHERE id = ?
        LIMIT 1`,
        [id]
      );

      const row = rows[0];
      return row ? mapStylePackRowToRecord(row) : null;
    });
  }

  async listStylePacksByUserId(userId: string): Promise<StylePackRecord[]> {
    return withClient(async (client) => {
      const [rows] = await client.query<StylePackRow[]>(
        `SELECT
          id,
          user_id,
          name,
          source_type,
          source_file_url,
          transcript_text,
          summary_text,
          rules_json,
          prompt_profile,
          provider,
          model_name,
          model_tier,
          version,
          status,
          created_at,
          updated_at,
          activated_at
        FROM style_packs
        WHERE user_id = ?
        ORDER BY updated_at DESC`,
        [userId]
      );

      return rows.map((row) => mapStylePackRowToRecord(row));
    });
  }
}

export const createMySqlStylePackRepository = (): StylePackRepository =>
  new MySqlStylePackRepository();

export const createNoopStylePackRepository = (): StylePackRepository => ({
  async saveStylePack() {
    return undefined;
  },
  async updateStylePack() {
    return undefined;
  },
  async appendRuleVersion() {
    return undefined;
  },
  async findById() {
    return null;
  },
  async listStylePacksByUserId() {
    return [];
  }
});

async function ensureUserExists(
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  userId: string,
  now: Date
): Promise<void> {
  const timestamp = formatDateTime(now);
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
    ) VALUES (?, ?, NULL, ?, NULL, ?, ?, ?)
    ON DUPLICATE KEY UPDATE updated_at = VALUES(updated_at)`,
    [userId, `dev:${userId}`, `User ${userId.slice(0, 8)}`, "active", timestamp, timestamp]
  );
}

function mapStylePackRowToRecord(row: StylePackRow): StylePackRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    sourceType: row.source_type,
    sourceFileUrl: row.source_file_url,
    transcriptText: row.transcript_text,
    summaryText: row.summary_text,
    rulesJson: decodeJson(row.rules_json),
    promptProfile: decodeJson(row.prompt_profile),
    provider: row.provider,
    modelName: row.model_name,
    modelTier: row.model_tier,
    version: row.version,
    status: row.status,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    activatedAt: row.activated_at ? toDate(row.activated_at) : null
  };
}

function pushAssignment(
  assignments: string[],
  values: unknown[],
  column: string,
  value: unknown
): void {
  if (value !== undefined) {
    assignments.push(`${column} = ?`);
    values.push(value ?? null);
  }
}

function encodeRequiredJson(value: JsonValue): string {
  return JSON.stringify(value);
}

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

function formatOptionalDateTime(value?: Date | null): string | null {
  if (!value) {
    return null;
  }
  return formatDateTime(value);
}
