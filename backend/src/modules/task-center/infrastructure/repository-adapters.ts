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

  async findByIdForUser(id: string, userId: string): Promise<AsyncTaskRecord | null> {
    const task = this.tasks.get(id) ?? null;
    if (!task || task.userId !== userId) {
      return null;
    }
    return task;
  }

  async countCreatedByUserAndTypeSince(
    userId: string,
    taskType: AsyncTaskRecord["taskType"],
    since: Date
  ): Promise<number> {
    return Array.from(this.tasks.values()).filter(
      (task) =>
        task.userId === userId &&
        task.taskType === taskType &&
        task.createdAt >= since
    ).length;
  }

  async findLatestByBizForUser(
    userId: string,
    bizType: string,
    bizId: string
  ): Promise<AsyncTaskRecord | null> {
    return (
      Array.from(this.tasks.values())
        .filter((task) => task.userId === userId)
        .filter((task) => task.bizType === bizType && task.bizId === bizId)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ??
      null
    );
  }

  async claimNextReadyTask(input: {
    workerId: string;
    taskTypes: string[];
    leaseMs: number;
  }): Promise<AsyncTaskRecord | null> {
    const now = new Date();
    const readyTask = Array.from(this.tasks.values())
      .filter((task) => input.taskTypes.includes(task.taskType))
      .filter((task) => (task.availableAt ?? now) <= now)
      .filter((task) => task.attemptCount < task.maxAttempts)
      .filter(
        (task) =>
          task.status === "uploaded" ||
          (task.status === "processing" &&
            !!task.lockedAt &&
            task.lockedAt.getTime() <= now.getTime() - input.leaseMs)
      )
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0];

    if (!readyTask) {
      return null;
    }

    const claimedTask: AsyncTaskRecord = {
      ...readyTask,
      status: "processing",
      lockedAt: now,
      lockedBy: input.workerId,
      attemptCount: readyTask.attemptCount + 1,
      updatedAt: now,
      errorCode: null,
      errorMessage: null
    };
    this.tasks.set(claimedTask.id, claimedTask);
    return claimedTask;
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
  payload_json: string | JsonValue | null;
  status: string;
  progress: number;
  result_summary: string | null;
  result_json: string | JsonValue | null;
  idempotency_key: string | null;
  provider_meta: string | Record<string, JsonValue> | null;
  error_code: string | null;
  error_message: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  finished_at: Date | string | null;
  available_at: Date | string | null;
  locked_at: Date | string | null;
  locked_by: string | null;
  attempt_count: number;
  max_attempts: number;
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
          payload_json,
          status,
          progress,
          result_summary,
          result_json,
          idempotency_key,
          provider_meta,
          error_code,
          error_message,
          created_at,
          updated_at,
          finished_at,
          available_at,
          locked_at,
          locked_by,
          attempt_count,
          max_attempts
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.id,
          task.userId,
          task.taskType,
          task.bizType,
          task.bizId ?? null,
          encodeJson(task.payloadJson),
          task.status,
          task.progress,
          task.resultSummary ?? null,
          encodeJson(task.resultJson),
          task.idempotencyKey ?? null,
          encodeJson(task.providerMeta),
          task.errorCode ?? null,
          task.errorMessage ?? null,
          formatDateTime(task.createdAt),
          formatDateTime(task.updatedAt),
          formatOptionalDateTime(task.finishedAt),
          formatOptionalDateTime(task.availableAt) ?? formatDateTime(task.createdAt),
          formatOptionalDateTime(task.lockedAt),
          task.lockedBy ?? null,
          task.attemptCount,
          task.maxAttempts
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
    if (patch.resultJson !== undefined) {
      assignments.push("result_json = ?");
      values.push(encodeJson(patch.resultJson));
    }
    if (patch.idempotencyKey !== undefined) {
      assignments.push("idempotency_key = ?");
      values.push(patch.idempotencyKey ?? null);
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
    if (patch.availableAt !== undefined) {
      assignments.push("available_at = ?");
      values.push(formatOptionalDateTime(patch.availableAt));
    }
    if (patch.lockedAt !== undefined) {
      assignments.push("locked_at = ?");
      values.push(formatOptionalDateTime(patch.lockedAt));
    }
    if (patch.lockedBy !== undefined) {
      assignments.push("locked_by = ?");
      values.push(patch.lockedBy ?? null);
    }
    if (patch.attemptCount !== undefined) {
      assignments.push("attempt_count = ?");
      values.push(patch.attemptCount);
    }
    if (patch.maxAttempts !== undefined) {
      assignments.push("max_attempts = ?");
      values.push(patch.maxAttempts);
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
          payload_json,
          status,
          progress,
          result_summary,
          result_json,
          idempotency_key,
          provider_meta,
          error_code,
          error_message,
          created_at,
          updated_at,
          finished_at,
          available_at,
          locked_at,
          locked_by,
          attempt_count,
          max_attempts
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

  async findByIdForUser(id: string, userId: string): Promise<AsyncTaskRecord | null> {
    return withClient(async (client) => {
      const [rows] = await client.query<AsyncTaskRow[]>(
        `SELECT
          id,
          user_id,
          task_type,
          biz_type,
          biz_id,
          payload_json,
          status,
          progress,
          result_summary,
          result_json,
          idempotency_key,
          provider_meta,
          error_code,
          error_message,
          created_at,
          updated_at,
          finished_at,
          available_at,
          locked_at,
          locked_by,
          attempt_count,
          max_attempts
        FROM async_tasks
        WHERE id = ? AND user_id = ?
        LIMIT 1`,
        [id, userId]
      );

      const row = rows[0];
      if (!row) {
        return null;
      }

      return mapAsyncTaskRowToRecord(row);
    });
  }

  async countCreatedByUserAndTypeSince(
    userId: string,
    taskType: AsyncTaskRecord["taskType"],
    since: Date
  ): Promise<number> {
    return withClient(async (client) => {
      const [rows] = await client.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total
         FROM async_tasks
         WHERE user_id = ? AND task_type = ? AND created_at >= ?`,
        [userId, taskType, formatDateTime(since)]
      );
      return Number(rows[0]?.total ?? 0);
    });
  }

  async findLatestByBizForUser(
    userId: string,
    bizType: string,
    bizId: string
  ): Promise<AsyncTaskRecord | null> {
    return withClient(async (client) => {
      const [rows] = await client.query<AsyncTaskRow[]>(
        `SELECT
          id,
          user_id,
          task_type,
          biz_type,
          biz_id,
          payload_json,
          status,
          progress,
          result_summary,
          result_json,
          idempotency_key,
          provider_meta,
          error_code,
          error_message,
          created_at,
          updated_at,
          finished_at,
          available_at,
          locked_at,
          locked_by,
          attempt_count,
          max_attempts
        FROM async_tasks
        WHERE user_id = ? AND biz_type = ? AND biz_id = ?
        ORDER BY created_at DESC
        LIMIT 1`,
        [userId, bizType, bizId]
      );

      const row = rows[0];
      if (!row) {
        return null;
      }

      return mapAsyncTaskRowToRecord(row);
    });
  }

  async claimNextReadyTask(input: {
    workerId: string;
    taskTypes: string[];
    leaseMs: number;
  }): Promise<AsyncTaskRecord | null> {
    return withClient(async (client) => {
      await client.beginTransaction();

      try {
        const now = new Date();
        const expiredAt = new Date(now.getTime() - input.leaseMs);
        const taskTypePlaceholders = input.taskTypes.map(() => "?").join(", ");
        const [rows] = await client.query<AsyncTaskRow[]>(
          `SELECT
             id,
             user_id,
             task_type,
             biz_type,
             biz_id,
             payload_json,
             status,
             progress,
             result_summary,
             result_json,
             idempotency_key,
             provider_meta,
             error_code,
             error_message,
             created_at,
             updated_at,
             finished_at,
             available_at,
             locked_at,
             locked_by,
             attempt_count,
             max_attempts
           FROM async_tasks
           WHERE task_type IN (${taskTypePlaceholders})
             AND available_at <= ?
             AND attempt_count < max_attempts
             AND (
               status = 'uploaded'
               OR (status = 'processing' AND locked_at IS NOT NULL AND locked_at <= ?)
             )
           ORDER BY available_at ASC, created_at ASC
           LIMIT 1
           FOR UPDATE`,
          [...input.taskTypes, formatDateTime(now), formatDateTime(expiredAt)]
        );

        const row = rows[0];
        if (!row) {
          await client.commit();
          return null;
        }

        const attemptCount = Number(row.attempt_count ?? 0) + 1;
        await client.query(
          `UPDATE async_tasks
           SET status = ?, locked_at = ?, locked_by = ?, updated_at = ?, attempt_count = ?, error_code = NULL, error_message = NULL
           WHERE id = ?`,
          [
            "processing",
            formatDateTime(now),
            input.workerId,
            formatDateTime(now),
            attemptCount,
            row.id
          ]
        );

        await client.commit();
        return {
          ...mapAsyncTaskRowToRecord(row),
          status: "processing",
          lockedAt: now,
          lockedBy: input.workerId,
          attemptCount,
          updatedAt: now,
          errorCode: null,
          errorMessage: null
        };
      } catch (error) {
        await client.rollback();
        throw error;
      }
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
  },
  async findByIdForUser() {
    return null;
  },
  async countCreatedByUserAndTypeSince() {
    return 0;
  },
  async findLatestByBizForUser() {
    return null;
  },
  async claimNextReadyTask() {
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
    payloadJson: decodeJson(row.payload_json),
    status: row.status as AsyncTaskRecord["status"],
    progress: row.progress,
    resultSummary: row.result_summary,
    resultJson: decodeJson(row.result_json),
    idempotencyKey: row.idempotency_key,
    providerMeta: decodeJson(row.provider_meta),
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    finishedAt: row.finished_at ? toDate(row.finished_at) : null,
    availableAt: row.available_at ? toDate(row.available_at) : null,
    lockedAt: row.locked_at ? toDate(row.locked_at) : null,
    lockedBy: row.locked_by,
    attemptCount: Number(row.attempt_count ?? 0),
    maxAttempts: Number(row.max_attempts ?? 3)
  };
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
