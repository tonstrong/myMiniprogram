import { withClient } from "../../../app/db";
import type { SavedOutfitRepository } from "./index";
import type {
  SavedOutfitItemRecord,
  SavedOutfitListRecord,
  SavedOutfitRecord
} from "./persistence";
import type { RowDataPacket } from "mysql2/promise";

export class InMemorySavedOutfitRepository implements SavedOutfitRepository {
  private outfits = new Map<string, SavedOutfitRecord>();
  private items = new Map<string, SavedOutfitItemRecord[]>();

  async saveOutfit(record: SavedOutfitRecord, items: SavedOutfitItemRecord[]): Promise<void> {
    this.outfits.set(record.id, record);
    this.items.set(record.id, items);
  }

  async listByUser(
    userId: string,
    query: { pageNo: number; pageSize: number }
  ): Promise<{ items: SavedOutfitListRecord[]; total: number }> {
    const outfits = Array.from(this.outfits.values())
      .filter((item) => item.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const start = (query.pageNo - 1) * query.pageSize;
    const page = outfits.slice(start, start + query.pageSize).map((item) => ({
      id: item.id,
      userId: item.userId,
      sourceType: item.sourceType,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      coverImageUrl: undefined,
      itemCount: this.items.get(item.id)?.length || 0
    }));

    return {
      items: page,
      total: outfits.length
    };
  }
}

export const createInMemorySavedOutfitRepository = (): SavedOutfitRepository =>
  new InMemorySavedOutfitRepository();

export class MySqlSavedOutfitRepository implements SavedOutfitRepository {
  async saveOutfit(record: SavedOutfitRecord, items: SavedOutfitItemRecord[]): Promise<void> {
    await withClient(async (client) => {
      await client.query("START TRANSACTION");
      try {
        await client.query(
          `INSERT INTO saved_outfits (
            id,
            user_id,
            source_type,
            cover_item_id,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?)` ,
          [
            record.id,
            record.userId,
            record.sourceType,
            record.coverItemId ?? null,
            formatDateTime(record.createdAt),
            formatDateTime(record.updatedAt)
          ]
        );

        for (const item of items) {
          await client.query(
            `INSERT INTO saved_outfit_items (
              id,
              saved_outfit_id,
              item_id,
              slot_code,
              sort_order,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              item.id,
              item.savedOutfitId,
              item.itemId,
              item.slotCode,
              item.sortOrder,
              formatDateTime(item.createdAt)
            ]
          );
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });
  }

  async listByUser(
    userId: string,
    query: { pageNo: number; pageSize: number }
  ): Promise<{ items: SavedOutfitListRecord[]; total: number }> {
    return withClient(async (client) => {
      const [countRows] = await client.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM saved_outfits WHERE user_id = ?`,
        [userId]
      );
      const total = Number(countRows[0]?.total ?? 0);
      const offset = (query.pageNo - 1) * query.pageSize;

      const [rows] = await client.query<RowDataPacket[]>(
        `SELECT so.id,
                so.user_id,
                so.source_type,
                so.created_at,
                so.updated_at,
                ci.image_original_url AS cover_image_url,
                COUNT(soi.id) AS item_count
         FROM saved_outfits so
         LEFT JOIN clothing_items ci ON ci.id = so.cover_item_id
         LEFT JOIN saved_outfit_items soi ON soi.saved_outfit_id = so.id
         WHERE so.user_id = ?
         GROUP BY so.id, so.user_id, so.source_type, so.created_at, so.updated_at, ci.image_original_url
         ORDER BY so.created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, query.pageSize, offset]
      );

      return {
        items: rows.map((row) => ({
          id: String(row.id),
          userId: String(row.user_id),
          sourceType: String(row.source_type),
          createdAt: toDate(row.created_at as Date | string),
          updatedAt: toDate(row.updated_at as Date | string),
          coverImageUrl: sanitizeImageUrl((row.cover_image_url as string | null) ?? null),
          itemCount: Number(row.item_count ?? 0)
        })),
        total
      };
    });
  }
}

export const createMySqlSavedOutfitRepository = (): SavedOutfitRepository =>
  new MySqlSavedOutfitRepository();

function formatDateTime(value: Date): string {
  return value.toISOString().slice(0, 19).replace("T", " ");
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function sanitizeImageUrl(value?: string | null): string | undefined {
  if (!value) {
    return undefined;
  }
  if (value.startsWith("file://") || value.startsWith("wxfile://")) {
    return undefined;
  }
  return value;
}
