import type { RowDataPacket } from "mysql2/promise";
import { withClient } from "../../../app/db";
import type { JsonValue } from "../../../app/common/persistence";
import type { RecommendationRepository } from "./index";
import type {
  RecommendationExplainerRecord,
  RecommendationFeedbackRecord,
  RecommendationHomeCardRecord,
  RecommendationItemRecord,
  RecommendationListRecord,
  RecommendationPlannerRecord,
  RecommendationRecord
} from "./persistence";

export class InMemoryRecommendationRepository
  implements RecommendationRepository
{
  private recommendations = new Map<string, RecommendationRecord>();
  private items: RecommendationItemRecord[] = [];
  private feedback: RecommendationFeedbackRecord[] = [];
  private plannerOutputs = new Map<string, RecommendationPlannerRecord>();
  private explainerOutputs = new Map<string, RecommendationExplainerRecord>();

  async saveRecommendation(record: RecommendationRecord): Promise<void> {
    this.recommendations.set(record.id, record);
  }

  async updateRecommendation(
    id: string,
    patch: Partial<RecommendationRecord>
  ): Promise<void> {
    const current = this.recommendations.get(id);
    if (!current) {
      return undefined;
    }
    this.recommendations.set(id, { ...current, ...patch });
  }

  async replaceRecommendationItems(
    recommendationId: string,
    items: RecommendationItemRecord[]
  ): Promise<void> {
    this.items = this.items.filter((item) => item.recommendationId !== recommendationId);
    this.items.push(...items);
  }

  async findItemsByRecommendationId(
    recommendationId: string
  ): Promise<RecommendationItemRecord[]> {
    return this.items.filter((item) => item.recommendationId === recommendationId);
  }

  async listByUser(
    userId: string,
    query: { savedOnly?: boolean; pageNo: number; pageSize: number }
  ): Promise<{ items: RecommendationListRecord[]; total: number }> {
    const filtered = Array.from(this.recommendations.values())
      .filter((item) => item.userId === userId)
      .filter((item) => item.sourceType === "manual")
      .filter((item) => (query.savedOnly ? item.status === "saved" : true))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const start = (query.pageNo - 1) * query.pageSize;
    const pageItems = filtered.slice(start, start + query.pageSize).map((item) => ({
      id: item.id,
      userId: item.userId,
      scene: item.scene,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      coverImageUrl: undefined
    }));

    return { items: pageItems, total: filtered.length };
  }

  async saveFeedback(record: RecommendationFeedbackRecord): Promise<void> {
    this.feedback.push(record);
  }

  async findById(id: string): Promise<RecommendationRecord | null> {
    return this.recommendations.get(id) ?? null;
  }

  async countCreatedByUserSince(userId: string, since: Date): Promise<number> {
    return Array.from(this.recommendations.values()).filter(
      (record) =>
        record.userId === userId &&
        record.sourceType === "manual" &&
        record.createdAt >= since
    ).length;
  }

  async findDailyHomeByUserAndDate(
    userId: string,
    displayDate: string
  ): Promise<RecommendationHomeCardRecord | null> {
    const recommendation = Array.from(this.recommendations.values()).find(
      (record) =>
        record.userId === userId &&
        record.sourceType === "daily_home" &&
        record.displayDate === displayDate
    );
    if (!recommendation) {
      return null;
    }

    const coverItem = this.items.find((item) => item.recommendationId === recommendation.id);
    return {
      id: recommendation.id,
      userId: recommendation.userId,
      scene: recommendation.scene,
      sourceType: recommendation.sourceType,
      displayDate: recommendation.displayDate,
      status: recommendation.status,
      reasonText: recommendation.reasonText,
      createdAt: recommendation.createdAt,
      updatedAt: recommendation.updatedAt,
      coverImageUrl: coverItem ? undefined : undefined
    };
  }

  async listPreferredItemIds(userId: string, limit: number): Promise<string[]> {
    const preferredRecommendationIds = new Set<string>();
    this.feedback
      .filter(
        (entry) =>
          entry.userId === userId &&
          (entry.action === "like" || entry.action === "save")
      )
      .forEach((entry) => preferredRecommendationIds.add(entry.recommendationId));

    Array.from(this.recommendations.values())
      .filter((record) => record.userId === userId && record.status === "saved")
      .forEach((record) => preferredRecommendationIds.add(record.id));

    const scores = new Map<string, number>();
    this.items
      .filter((item) => preferredRecommendationIds.has(item.recommendationId))
      .forEach((item) => {
        scores.set(item.itemId, (scores.get(item.itemId) ?? 0) + 1);
      });

    return Array.from(scores.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, limit)
      .map(([itemId]) => itemId);
  }

  async savePlannerOutput(record: RecommendationPlannerRecord): Promise<void> {
    this.plannerOutputs.set(record.recommendationId, record);
  }

  async saveExplainerOutput(
    record: RecommendationExplainerRecord
  ): Promise<void> {
    this.explainerOutputs.set(record.recommendationId, record);
  }

  async findPlannerOutputByRecommendationId(
    recommendationId: string
  ): Promise<RecommendationPlannerRecord | null> {
    return this.plannerOutputs.get(recommendationId) ?? null;
  }

  async findExplainerOutputByRecommendationId(
    recommendationId: string
  ): Promise<RecommendationExplainerRecord | null> {
    return this.explainerOutputs.get(recommendationId) ?? null;
  }
}

export const createInMemoryRecommendationRepository =
  (): RecommendationRepository => new InMemoryRecommendationRepository();

interface RecommendationRow extends RowDataPacket {
  id: string;
  user_id: string;
  style_pack_id: string | null;
  scene: string;
  source_type: RecommendationRecord["sourceType"];
  display_date: Date | string | null;
  weather_json: string | JsonValue | null;
  provider: string | null;
  model_name: string | null;
  model_tier: string | null;
  retry_count: number;
  validator_result: string | JsonValue | null;
  reason_text: string | null;
  status: RecommendationRecord["status"];
  created_at: Date | string;
  updated_at: Date | string;
}

interface RecommendationItemRow extends RowDataPacket {
  id: string;
  recommendation_id: string;
  outfit_no: number;
  item_id: string;
  role: string;
  reason_text: string | null;
  alternative_json: string | JsonValue | null;
  created_at: Date | string;
}

export class MySqlRecommendationRepository implements RecommendationRepository {
  private plannerOutputs = new Map<string, RecommendationPlannerRecord>();
  private explainerOutputs = new Map<string, RecommendationExplainerRecord>();

  async saveRecommendation(record: RecommendationRecord): Promise<void> {
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO recommendations (
          id,
          user_id,
          style_pack_id,
          scene,
          source_type,
          display_date,
          weather_json,
          provider,
          model_name,
          model_tier,
          retry_count,
          validator_result,
          reason_text,
          status,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.userId,
          record.stylePackId ?? null,
          record.scene,
          record.sourceType,
          record.displayDate ?? null,
          encodeJson(record.weatherJson),
          record.provider ?? null,
          record.modelName ?? null,
          record.modelTier ?? null,
          record.retryCount ?? 0,
          encodeJson(record.validatorResult),
          record.reasonText ?? null,
          record.status,
          formatDateTime(record.createdAt),
          formatDateTime(record.updatedAt)
        ]
      );
    });
  }

  async updateRecommendation(
    id: string,
    patch: Partial<RecommendationRecord>
  ): Promise<void> {
    const assignments: string[] = [];
    const values: unknown[] = [];
    pushAssignment(assignments, values, "style_pack_id", patch.stylePackId);
    pushAssignment(assignments, values, "scene", patch.scene);
    pushAssignment(assignments, values, "source_type", patch.sourceType);
    pushAssignment(assignments, values, "display_date", patch.displayDate);
    if (patch.weatherJson !== undefined) {
      assignments.push("weather_json = ?");
      values.push(encodeJson(patch.weatherJson));
    }
    pushAssignment(assignments, values, "provider", patch.provider);
    pushAssignment(assignments, values, "model_name", patch.modelName);
    pushAssignment(assignments, values, "model_tier", patch.modelTier);
    if (patch.retryCount !== undefined) {
      assignments.push("retry_count = ?");
      values.push(patch.retryCount ?? 0);
    }
    if (patch.validatorResult !== undefined) {
      assignments.push("validator_result = ?");
      values.push(encodeJson(patch.validatorResult));
    }
    pushAssignment(assignments, values, "reason_text", patch.reasonText);
    pushAssignment(assignments, values, "status", patch.status);
    if (patch.updatedAt !== undefined) {
      assignments.push("updated_at = ?");
      values.push(formatDateTime(patch.updatedAt));
    }
    if (assignments.length === 0) {
      return;
    }
    values.push(id);
    await withClient(async (client) => {
      await client.query(
        `UPDATE recommendations SET ${assignments.join(", ")} WHERE id = ?`,
        values
      );
    });
  }

  async replaceRecommendationItems(
    recommendationId: string,
    items: RecommendationItemRecord[]
  ): Promise<void> {
    await withClient(async (client) => {
      await client.query(
        `DELETE FROM recommendation_items WHERE recommendation_id = ?`,
        [recommendationId]
      );
      for (const item of items) {
        await client.query(
          `INSERT INTO recommendation_items (
            id,
            recommendation_id,
            outfit_no,
            item_id,
            role,
            reason_text,
            alternative_json,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.recommendationId,
            item.outfitNo,
            item.itemId,
            item.role,
            item.reasonText ?? null,
            encodeJson(item.alternativeJson),
            formatDateTime(item.createdAt)
          ]
        );
      }
    });
  }

  async findItemsByRecommendationId(
    recommendationId: string
  ): Promise<RecommendationItemRecord[]> {
    return withClient(async (client) => {
      const [rows] = await client.query<RecommendationItemRow[]>(
        `SELECT id, recommendation_id, outfit_no, item_id, role, reason_text, alternative_json, created_at
         FROM recommendation_items
         WHERE recommendation_id = ?
         ORDER BY outfit_no ASC,
                  CASE role
                    WHEN 'primary' THEN 0
                    WHEN 'secondary' THEN 1
                    ELSE 2
                  END ASC,
                  created_at ASC,
                  id ASC`,
        [recommendationId]
      );
      return rows.map((row) => ({
        id: row.id,
        recommendationId: row.recommendation_id,
        outfitNo: row.outfit_no,
        itemId: row.item_id,
        role: row.role,
        reasonText: row.reason_text,
        alternativeJson: decodeJson(row.alternative_json),
        createdAt: toDate(row.created_at)
      }));
    });
  }

  async listByUser(
    userId: string,
    query: { savedOnly?: boolean; pageNo: number; pageSize: number }
  ): Promise<{ items: RecommendationListRecord[]; total: number }> {
    return withClient(async (client) => {
      const whereClauses = ["user_id = ?", "source_type = 'manual'"];
      const params: unknown[] = [userId];

      if (query.savedOnly) {
        whereClauses.push("status = 'saved'");
      }

      const where = whereClauses.join(" AND ");
      const [countRows] = await client.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM recommendations WHERE ${where}`,
        params
      );
      const total = Number(countRows[0]?.total ?? 0);

      const offset = (query.pageNo - 1) * query.pageSize;
      const [rows] = await client.query<RecommendationRow[]>(
        `SELECT id, user_id, style_pack_id, scene, weather_json, provider, model_name, model_tier, retry_count,
                source_type, display_date, validator_result, reason_text, status, created_at, updated_at
         FROM recommendations
         WHERE ${where}
           AND source_type = 'manual'
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, query.pageSize, offset]
      );

      const items: RecommendationListRecord[] = [];
      for (const row of rows) {
        const [coverRows] = await client.query<RowDataPacket[]>(
          `SELECT c.image_original_url AS cover_image_url
           FROM recommendation_items ri
           INNER JOIN clothing_items c ON c.id = ri.item_id
           WHERE ri.recommendation_id = ?
           ORDER BY ri.outfit_no ASC,
                    CASE ri.role WHEN 'primary' THEN 0 WHEN 'secondary' THEN 1 ELSE 2 END ASC,
                    ri.created_at ASC,
                    ri.id ASC
           LIMIT 1`,
          [row.id]
        );

        items.push({
          id: row.id,
          userId: row.user_id,
          scene: row.scene,
          status: row.status,
          createdAt: toDate(row.created_at),
          updatedAt: toDate(row.updated_at),
          coverImageUrl: sanitizeRecommendationImageUrl(
            (coverRows[0]?.cover_image_url as string | undefined) ?? undefined
          )
        });
      }

      return { items, total };
    });
  }

  async saveFeedback(record: RecommendationFeedbackRecord): Promise<void> {
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO recommendation_feedback (
          id,
          recommendation_id,
          user_id,
          action,
          reason_tags,
          comment,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.recommendationId,
          record.userId,
          record.action,
          encodeJson(record.reasonTags),
          record.comment ?? null,
          formatDateTime(record.createdAt)
        ]
      );
    });
  }

  async findById(id: string): Promise<RecommendationRecord | null> {
    return withClient(async (client) => {
      const [rows] = await client.query<RecommendationRow[]>(
        `SELECT id, user_id, style_pack_id, scene, weather_json, provider, model_name, model_tier, retry_count,
                source_type, display_date, validator_result, reason_text, status, created_at, updated_at
         FROM recommendations
         WHERE id = ?
         LIMIT 1`,
        [id]
      );
      const row = rows[0];
      if (!row) {
        return null;
      }
      return {
        id: row.id,
        userId: row.user_id,
        stylePackId: row.style_pack_id,
        scene: row.scene,
        sourceType: row.source_type,
        displayDate: toDateOnly(row.display_date),
        weatherJson: decodeJson(row.weather_json),
        provider: row.provider,
        modelName: row.model_name,
        modelTier: row.model_tier,
        retryCount: row.retry_count,
        validatorResult: decodeJson(row.validator_result),
        reasonText: row.reason_text,
        status: row.status,
        createdAt: toDate(row.created_at),
        updatedAt: toDate(row.updated_at)
      };
    });
  }

  async countCreatedByUserSince(userId: string, since: Date): Promise<number> {
    return withClient(async (client) => {
      const [rows] = await client.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total
         FROM recommendations
         WHERE user_id = ? AND source_type = 'manual' AND created_at >= ?`,
        [userId, formatDateTime(since)]
      );
      return Number(rows[0]?.total ?? 0);
    });
  }

  async findDailyHomeByUserAndDate(
    userId: string,
    displayDate: string
  ): Promise<RecommendationHomeCardRecord | null> {
    return withClient(async (client) => {
      const [rows] = await client.query<RowDataPacket[]>(
        `SELECT
           r.id,
           r.user_id,
           r.scene,
           r.source_type,
           r.display_date,
           r.status,
           r.reason_text,
           r.created_at,
           r.updated_at,
           c.image_original_url AS cover_image_url
         FROM recommendations r
         LEFT JOIN recommendation_items ri
           ON ri.recommendation_id = r.id
          AND ri.outfit_no = 1
         LEFT JOIN clothing_items c
           ON c.id = ri.item_id
         WHERE r.user_id = ?
           AND r.source_type = 'daily_home'
           AND r.display_date = ?
         ORDER BY
           CASE ri.role WHEN 'primary' THEN 0 WHEN 'secondary' THEN 1 ELSE 2 END ASC,
           ri.created_at ASC,
           ri.id ASC
         LIMIT 1`,
        [userId, displayDate]
      );

      const row = rows[0];
      if (!row) {
        return null;
      }

      return {
        id: String(row.id),
        userId: String(row.user_id),
        scene: String(row.scene),
        sourceType: row.source_type as RecommendationRecord["sourceType"],
        displayDate: toDateOnly(row.display_date),
        status: row.status as RecommendationRecord["status"],
        reasonText: typeof row.reason_text === "string" ? row.reason_text : null,
        createdAt: toDate(row.created_at as Date | string),
        updatedAt: toDate(row.updated_at as Date | string),
        coverImageUrl: sanitizeRecommendationImageUrl(
          (row.cover_image_url as string | undefined) ?? undefined
        )
      };
    });
  }

  async listPreferredItemIds(userId: string, limit: number): Promise<string[]> {
    return withClient(async (client) => {
      const [rows] = await client.query<RowDataPacket[]>(
        `SELECT
           ri.item_id AS item_id,
           COUNT(*) AS score,
           MAX(r.created_at) AS last_used_at
         FROM recommendations r
         INNER JOIN recommendation_items ri
           ON ri.recommendation_id = r.id
         LEFT JOIN recommendation_feedback rf
           ON rf.recommendation_id = r.id
          AND rf.user_id = ?
          AND rf.action IN ('like', 'save')
         WHERE r.user_id = ?
           AND r.source_type = 'manual'
           AND (r.status = 'saved' OR rf.id IS NOT NULL)
         GROUP BY ri.item_id
         ORDER BY score DESC, last_used_at DESC
         LIMIT ?`,
        [userId, userId, limit]
      );

      return rows
        .map((row) => (typeof row.item_id === "string" ? row.item_id : ""))
        .filter((itemId) => itemId.length > 0);
    });
  }

  async savePlannerOutput(record: RecommendationPlannerRecord): Promise<void> {
    this.plannerOutputs.set(record.recommendationId, record);
  }

  async saveExplainerOutput(record: RecommendationExplainerRecord): Promise<void> {
    this.explainerOutputs.set(record.recommendationId, record);
  }

  async findPlannerOutputByRecommendationId(
    recommendationId: string
  ): Promise<RecommendationPlannerRecord | null> {
    return this.plannerOutputs.get(recommendationId) ?? null;
  }

  async findExplainerOutputByRecommendationId(
    recommendationId: string
  ): Promise<RecommendationExplainerRecord | null> {
    return this.explainerOutputs.get(recommendationId) ?? null;
  }
}

export const createMySqlRecommendationRepository =
  (): RecommendationRepository => new MySqlRecommendationRepository();

export const createNoopRecommendationRepository =
  (): RecommendationRepository => ({
    async saveRecommendation() {
      return undefined;
    },
    async updateRecommendation() {
      return undefined;
    },
    async replaceRecommendationItems() {
      return undefined;
    },
    async findItemsByRecommendationId() {
      return [];
    },
    async listByUser() {
      return { items: [], total: 0 };
    },
    async saveFeedback() {
      return undefined;
    },
    async findById() {
      return null;
    },
    async countCreatedByUserSince() {
      return 0;
    },
    async findDailyHomeByUserAndDate() {
      return null;
    },
    async listPreferredItemIds() {
      return [];
    },
    async savePlannerOutput() {
      return undefined;
    },
    async saveExplainerOutput() {
      return undefined;
    },
    async findPlannerOutputByRecommendationId() {
      return null;
    },
    async findExplainerOutputByRecommendationId() {
      return null;
    }
  });

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

function toDateOnly(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

function sanitizeRecommendationImageUrl(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  if (value.startsWith("file://") || value.startsWith("wxfile://")) {
    return undefined;
  }
  return value;
}
