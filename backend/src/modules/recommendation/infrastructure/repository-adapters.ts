import type { RowDataPacket } from "mysql2/promise";
import { withClient } from "../../../app/db";
import type { JsonValue } from "../../../app/common/persistence";
import type { RecommendationRepository } from "./index";
import type {
  RecommendationExplainerRecord,
  RecommendationFeedbackRecord,
  RecommendationItemRecord,
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

  async saveRecommendationItems(
    items: RecommendationItemRecord[]
  ): Promise<void> {
    this.items.push(...items);
  }

  async findItemsByRecommendationId(
    recommendationId: string
  ): Promise<RecommendationItemRecord[]> {
    return this.items.filter((item) => item.recommendationId === recommendationId);
  }

  async saveFeedback(record: RecommendationFeedbackRecord): Promise<void> {
    this.feedback.push(record);
  }

  async findById(id: string): Promise<RecommendationRecord | null> {
    return this.recommendations.get(id) ?? null;
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record.id,
          record.userId,
          record.stylePackId ?? null,
          record.scene,
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

  async saveRecommendationItems(items: RecommendationItemRecord[]): Promise<void> {
    if (items.length === 0) {
      return;
    }
    await withClient(async (client) => {
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
                validator_result, reason_text, status, created_at, updated_at
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
    async saveRecommendationItems() {
      return undefined;
    },
    async findItemsByRecommendationId() {
      return [];
    },
    async saveFeedback() {
      return undefined;
    },
    async findById() {
      return null;
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
