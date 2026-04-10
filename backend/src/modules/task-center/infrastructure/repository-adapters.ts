import type { RowDataPacket } from "mysql2/promise";
import { withClient } from "../../../app/db";
import type { JsonValue } from "../../../app/common/persistence";
import type { TaskRepository } from "./index";
import type { AsyncTaskRecord } from "./persistence";

export class InMemoryTaskRepository implements TaskRepository {
  private tasks = new Map<string, AsyncTaskRecord>();

  async create(task: AsyncTaskRecord): Promise<void> {
    this.tasks.set(task.id, task);
  }

  async update(id: string, patch: Partial<AsyncTaskRecord>): Promise<void> {
    const current = this.tasks.get(id);
    if (!current) {
      return undefined;
    }
    this.tasks.set(id, { ...current, ...patch });
  }

  async findById(id: string): Promise<AsyncTaskRecord | null> {
    return this.tasks.get(id) ?? null;
  }
}

export const createInMemoryTaskRepository = (): TaskRepository =>
  new InMemoryTaskRepository();

interface AsyncTaskRow extends RowDataPacket {
  id: string;
  user_id: string;
  task_type: string;
  biz_type: string;
  biz_id: string | null;
  status: string;
  progress: number;
  result_summary: string | null;
  provider_meta: string | Record<string, JsonValue> | null;
  error_code: string | null;
  error_message: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  finished_at: Date | string | null;
}

export class MySqlTaskRepository implements TaskRepository {
  async create(task: AsyncTaskRecord): Promise<void> {
    await withClient(async (client) => {
      await ensureUserExists(client, task.userId, task.createdAt);
      await client.query(
        `INSERT INTO async_tasks (
          id,
          user_id,
          task_type,
          biz_type,
          biz_id,
          status,
          progress,
          result_summary,
          provider_meta,
          error_code,
          error_message,
          created_at,
          updated_at,
          finished_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.id,
          task.userId,
          task.taskType,
          task.bizType,
          task.bizId ?? null,
          task.status,
          task.progress,
          task.resultSummary ?? null,
          encodeJson(task.providerMeta),
          task.errorCode ?? null,
          task.errorMessage ?? null,
          formatDateTime(task.createdAt),
          formatDateTime(task.updatedAt),
          formatOptionalDateTime(task.finishedAt)
        ]
      );
    });
  }

  async update(id: string, patch: Partial<AsyncTaskRecord>): Promise<void> {
    const assignments: string[] = [];
    const values: unknown[] = [];

    if (patch.status !== undefined) {
      assignments.push("status = ?");
      values.push(patch.status);
    }
    if (patch.progress !== undefined) {
      assignments.push("progress = ?");
      values.push(patch.progress);
    }
    if (patch.resultSummary !== undefined) {
      assignments.push("result_summary = ?");
      values.push(patch.resultSummary ?? null);
    }
    if (patch.providerMeta !== undefined) {
      assignments.push("provider_meta = ?");
      values.push(encodeJson(patch.providerMeta));
    }
    if (patch.errorCode !== undefined) {
      assignments.push("error_code = ?");
      values.push(patch.errorCode ?? null);
    }
    if (patch.errorMessage !== undefined) {
      assignments.push("error_message = ?");
      values.push(patch.errorMessage ?? null);
    }
    if (patch.updatedAt !== undefined) {
      assignments.push("updated_at = ?");
      values.push(formatDateTime(patch.updatedAt));
    }
    if (patch.finishedAt !== undefined) {
      assignments.push("finished_at = ?");
      values.push(formatOptionalDateTime(patch.finishedAt));
    }

    if (assignments.length === 0) {
      return;
    }

    values.push(id);
    await withClient(async (client) => {
      await client.query(
        `UPDATE async_tasks SET ${assignments.join(", ")} WHERE id = ?`,
        values
      );
    });
  }

  async findById(id: string): Promise<AsyncTaskRecord | null> {
    return withClient(async (client) => {
      const [rows] = await client.query<AsyncTaskRow[]>(
        `SELECT
          id,
          user_id,
          task_type,
          biz_type,
          biz_id,
          status,
          progress,
          result_summary,
          provider_meta,
          error_code,
          error_message,
          created_at,
          updated_at,
          finished_at
        FROM async_tasks
        WHERE id = ?
        LIMIT 1`,
        [id]
      );

      const row = rows[0];
      if (!row) {
        return null;
      }

      return mapAsyncTaskRowToRecord(row);
    });
  }
}

export const createMySqlTaskRepository = (): TaskRepository =>
  new MySqlTaskRepository();

export const createNoopTaskRepository = (): TaskRepository => ({
  async create() {
    return undefined;
  },
  async update() {
    return undefined;
  },
  async findById() {
    return null;
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

function mapAsyncTaskRowToRecord(row: AsyncTaskRow): AsyncTaskRecord {
  return {
    id: row.id,
    userId: row.user_id,
    taskType: row.task_type as AsyncTaskRecord["taskType"],
    bizType: row.biz_type,
    bizId: row.biz_id,
    status: row.status as AsyncTaskRecord["status"],
    progress: row.progress,
    resultSummary: row.result_summary,
    providerMeta: decodeJson(row.provider_meta),
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    finishedAt: row.finished_at ? toDate(row.finished_at) : null
  };
}

function encodeJson(value?: JsonValue | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return JSON.stringify(value);
}

function decodeJson(
  value: string | Record<string, JsonValue> | null
): JsonValue | null {
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return JSON.parse(value) as JsonValue;
  }
  return value;
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
