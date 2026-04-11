import type { RowDataPacket } from "mysql2/promise";
import { withClient } from "../../../app/db";
import type { JsonValue } from "../../../app/common/persistence";
import type { ClosetRepository } from "./index";
import type {
  ClothingItemImageRecord,
  ClothingItemAttributeHistoryRecord,
  ClothingItemRecord
} from "./persistence";

export class InMemoryClosetRepository implements ClosetRepository {
  private items = new Map<string, ClothingItemRecord>();
  private images = new Map<string, ClothingItemImageRecord>();
  private attributeHistory: ClothingItemAttributeHistoryRecord[] = [];

  async saveItem(item: ClothingItemRecord): Promise<void> {
    this.items.set(item.id, item);
  }

  async updateItem(
    id: string,
    patch: Partial<ClothingItemRecord>
  ): Promise<void> {
    const current = this.items.get(id);
    if (!current) {
      return undefined;
    }
    this.items.set(id, { ...current, ...patch });
  }

  async findItemById(id: string): Promise<ClothingItemRecord | null> {
    return this.items.get(id) ?? null;
  }

  async listItemsByUserId(userId: string): Promise<ClothingItemRecord[]> {
    return Array.from(this.items.values()).filter((item) => item.userId === userId);
  }

  async saveItemImage(image: ClothingItemImageRecord): Promise<void> {
    this.images.set(image.itemId, image);
  }

  async findItemImageByItemId(itemId: string): Promise<ClothingItemImageRecord | null> {
    return this.images.get(itemId) ?? null;
  }

  async appendAttributeHistory(
    entry: ClothingItemAttributeHistoryRecord
  ): Promise<void> {
    this.attributeHistory.push(entry);
  }
}

export const createInMemoryClosetRepository = (): ClosetRepository =>
  new InMemoryClosetRepository();

interface ClothingItemRow extends RowDataPacket {
  id: string;
  user_id: string;
  image_original_url: string;
  image_access_key: string | null;
  category: string | null;
  sub_category: string | null;
  colors: string | JsonValue[] | null;
  pattern: string | null;
  material: string | null;
  fit: string | JsonValue[] | null;
  length: string | null;
  seasons: string | JsonValue[] | null;
  tags: string | JsonValue[] | null;
  occasion_tags: string | JsonValue[] | null;
  llm_confidence: string | Record<string, JsonValue> | null;
  provider: string | null;
  model_name: string | null;
  model_tier: string | null;
  retry_count: number;
  status: ClothingItemRecord["status"];
  source_type: ClothingItemRecord["sourceType"];
  created_at: Date | string;
  updated_at: Date | string;
  confirmed_at: Date | string | null;
}

interface ClothingItemImageRow extends RowDataPacket {
  item_id: string;
  content_type: string;
  byte_size: number;
  bytes: Buffer;
  created_at: Date | string;
  updated_at: Date | string;
}

export class MySqlClosetRepository implements ClosetRepository {
  async saveItem(item: ClothingItemRecord): Promise<void> {
    await withClient(async (client) => {
      await ensureUserExists(client, item.userId, item.createdAt);
      await client.query(
        `INSERT INTO clothing_items (
          id,
          user_id,
          image_original_url,
          image_access_key,
          category,
          sub_category,
          colors,
          pattern,
          material,
          fit,
          length,
          seasons,
          tags,
          occasion_tags,
          llm_confidence,
          provider,
          model_name,
          model_tier,
          retry_count,
          status,
          source_type,
          created_at,
          updated_at,
          confirmed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.userId,
          item.imageOriginalUrl,
          item.imageAccessKey ?? null,
          item.category ?? null,
          item.subCategory ?? null,
          encodeJson(item.colors),
          item.pattern ?? null,
          item.material ?? null,
          encodeJson(item.fit),
          item.length ?? null,
          encodeJson(item.seasons),
          encodeJson(item.tags),
          encodeJson(item.occasionTags),
          encodeJson(item.llmConfidence),
          item.provider ?? null,
          item.modelName ?? null,
          item.modelTier ?? null,
          item.retryCount ?? 0,
          item.status,
          item.sourceType ?? null,
          formatDateTime(item.createdAt),
          formatDateTime(item.updatedAt),
          formatOptionalDateTime(item.confirmedAt)
        ]
      );
    });
  }

  async updateItem(id: string, patch: Partial<ClothingItemRecord>): Promise<void> {
    const assignments: string[] = [];
    const values: unknown[] = [];

    pushAssignment(assignments, values, "image_original_url", patch.imageOriginalUrl);
    pushAssignment(assignments, values, "image_access_key", patch.imageAccessKey);
    pushAssignment(assignments, values, "category", patch.category);
    pushAssignment(assignments, values, "sub_category", patch.subCategory);
    if (patch.colors !== undefined) {
      assignments.push("colors = ?");
      values.push(encodeJson(patch.colors));
    }
    pushAssignment(assignments, values, "pattern", patch.pattern);
    pushAssignment(assignments, values, "material", patch.material);
    if (patch.fit !== undefined) {
      assignments.push("fit = ?");
      values.push(encodeJson(patch.fit));
    }
    pushAssignment(assignments, values, "length", patch.length);
    if (patch.seasons !== undefined) {
      assignments.push("seasons = ?");
      values.push(encodeJson(patch.seasons));
    }
    if (patch.tags !== undefined) {
      assignments.push("tags = ?");
      values.push(encodeJson(patch.tags));
    }
    if (patch.occasionTags !== undefined) {
      assignments.push("occasion_tags = ?");
      values.push(encodeJson(patch.occasionTags));
    }
    if (patch.llmConfidence !== undefined) {
      assignments.push("llm_confidence = ?");
      values.push(encodeJson(patch.llmConfidence));
    }
    pushAssignment(assignments, values, "provider", patch.provider);
    pushAssignment(assignments, values, "model_name", patch.modelName);
    pushAssignment(assignments, values, "model_tier", patch.modelTier);

    if (patch.retryCount !== undefined) {
      assignments.push("retry_count = ?");
      values.push(patch.retryCount ?? 0);
    }

    pushAssignment(assignments, values, "status", patch.status);
    pushAssignment(assignments, values, "source_type", patch.sourceType);

    if (patch.updatedAt !== undefined) {
      assignments.push("updated_at = ?");
      values.push(formatDateTime(patch.updatedAt));
    }
    if (patch.confirmedAt !== undefined) {
      assignments.push("confirmed_at = ?");
      values.push(formatOptionalDateTime(patch.confirmedAt));
    }

    if (assignments.length === 0) {
      return;
    }

    values.push(id);
    await withClient(async (client) => {
      await client.query(
        `UPDATE clothing_items SET ${assignments.join(", ")} WHERE id = ?`,
        values
      );
    });
  }

  async findItemById(id: string): Promise<ClothingItemRecord | null> {
    return withClient(async (client) => {
      const [rows] = await client.query<ClothingItemRow[]>(
        `SELECT
          id,
          user_id,
          image_original_url,
          image_access_key,
          category,
          sub_category,
          colors,
          pattern,
          material,
          fit,
          length,
          seasons,
          tags,
          occasion_tags,
          llm_confidence,
          provider,
          model_name,
          model_tier,
          retry_count,
          status,
          source_type,
          created_at,
          updated_at,
          confirmed_at
        FROM clothing_items
        WHERE id = ?
        LIMIT 1`,
        [id]
      );

      const row = rows[0];
      return row ? mapClothingItemRowToRecord(row) : null;
    });
  }

  async listItemsByUserId(userId: string): Promise<ClothingItemRecord[]> {
    return withClient(async (client) => {
      const [rows] = await client.query<ClothingItemRow[]>(
        `SELECT
          id,
          user_id,
          image_original_url,
          image_access_key,
          category,
          sub_category,
          colors,
          pattern,
          material,
          fit,
          length,
          seasons,
          tags,
          occasion_tags,
          llm_confidence,
          provider,
          model_name,
          model_tier,
          retry_count,
          status,
          source_type,
          created_at,
          updated_at,
          confirmed_at
        FROM clothing_items
        WHERE user_id = ? AND status <> 'deleted'
        ORDER BY updated_at DESC`,
        [userId]
      );

      return rows.map((row) => mapClothingItemRowToRecord(row));
    });
  }

  async saveItemImage(image: ClothingItemImageRecord): Promise<void> {
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO clothing_item_images (
          item_id,
          content_type,
          byte_size,
          bytes,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          content_type = VALUES(content_type),
          byte_size = VALUES(byte_size),
          bytes = VALUES(bytes),
          updated_at = VALUES(updated_at)`,
        [
          image.itemId,
          image.contentType,
          image.byteSize,
          image.bytes,
          formatDateTime(image.createdAt),
          formatDateTime(image.updatedAt)
        ]
      );
    });
  }

  async findItemImageByItemId(itemId: string): Promise<ClothingItemImageRecord | null> {
    return withClient(async (client) => {
      const [rows] = await client.query<ClothingItemImageRow[]>(
        `SELECT item_id, content_type, byte_size, bytes, created_at, updated_at
         FROM clothing_item_images
         WHERE item_id = ?
         LIMIT 1`,
        [itemId]
      );

      const row = rows[0];
      if (!row) {
        return null;
      }

      return {
        itemId: row.item_id,
        contentType: row.content_type,
        byteSize: row.byte_size,
        bytes: row.bytes,
        createdAt: toDate(row.created_at),
        updatedAt: toDate(row.updated_at)
      };
    });
  }

  async appendAttributeHistory(
    entry: ClothingItemAttributeHistoryRecord
  ): Promise<void> {
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO clothing_item_attribute_history (
          id,
          item_id,
          version_no,
          source,
          attributes_snapshot,
          changed_fields,
          operator_id,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          entry.id,
          entry.itemId,
          entry.versionNo,
          entry.source,
          encodeRequiredJson(entry.attributesSnapshot),
          encodeJson(entry.changedFields),
          entry.operatorId ?? null,
          formatDateTime(entry.createdAt)
        ]
      );
    });
  }
}

export const createMySqlClosetRepository = (): ClosetRepository =>
  new MySqlClosetRepository();

export const createNoopClosetRepository = (): ClosetRepository => ({
  async saveItem() {
    return undefined;
  },
  async updateItem() {
    return undefined;
  },
  async findItemById() {
    return null;
  },
  async listItemsByUserId() {
    return [];
  },
  async saveItemImage() {
    return undefined;
  },
  async findItemImageByItemId() {
    return null;
  },
  async appendAttributeHistory() {
    return undefined;
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

function mapClothingItemRowToRecord(row: ClothingItemRow): ClothingItemRecord {
  return {
    id: row.id,
    userId: row.user_id,
    imageOriginalUrl: sanitizeImageUrl(row.image_original_url),
    imageAccessKey: row.image_access_key,
    category: row.category,
    subCategory: row.sub_category,
    colors: decodeJson(row.colors),
    pattern: row.pattern,
    material: row.material,
    fit: decodeJson(row.fit),
    length: row.length,
    seasons: decodeJson(row.seasons),
    tags: decodeJson(row.tags),
    occasionTags: decodeJson(row.occasion_tags),
    llmConfidence: decodeJson(row.llm_confidence),
    provider: row.provider,
    modelName: row.model_name,
    modelTier: row.model_tier,
    retryCount: row.retry_count,
    status: row.status,
    sourceType: row.source_type,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
    confirmedAt: row.confirmed_at ? toDate(row.confirmed_at) : null
  };
}

function sanitizeImageUrl(value: string): string {
  if (
    !value ||
    value.startsWith("file://") ||
    value.startsWith("wxfile://") ||
    value.startsWith("http://tmp/") ||
    value.startsWith("https://tmp/")
  ) {
    return "";
  }
  return value;
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
