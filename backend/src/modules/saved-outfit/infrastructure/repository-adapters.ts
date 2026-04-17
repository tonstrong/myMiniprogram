import { withClient } from "../../../app/db";
import type { SavedOutfitRepository } from "./index";
import type {
  SavedOutfitItemRecord,
  SavedOutfitListRecord,
  SavedOutfitPreviewItemRecord,
  SavedOutfitRecord
} from "./persistence";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

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
      itemCount: this.items.get(item.id)?.length || 0,
      previewItems: (this.items.get(item.id) || []).map((savedItem) => ({
        itemId: savedItem.itemId,
        slotCode: savedItem.slotCode,
        sortOrder: savedItem.sortOrder,
        layoutX: savedItem.layoutX ?? undefined,
        layoutY: savedItem.layoutY ?? undefined,
        layoutW: savedItem.layoutW ?? undefined,
        layoutH: savedItem.layoutH ?? undefined,
        layerIndex: savedItem.layerIndex
      }))
    }));

    return {
      items: page,
      total: outfits.length
    };
  }

  async deleteOutfit(userId: string, savedOutfitId: string): Promise<boolean> {
    const record = this.outfits.get(savedOutfitId);
    if (!record || record.userId !== userId) {
      return false;
    }
    this.outfits.delete(savedOutfitId);
    this.items.delete(savedOutfitId);
    return true;
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
              layout_x,
              layout_y,
              layout_w,
              layout_h,
              layer_index,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
            [
              item.id,
              item.savedOutfitId,
              item.itemId,
              item.slotCode,
              item.sortOrder,
              item.layoutX ?? null,
              item.layoutY ?? null,
              item.layoutW ?? null,
              item.layoutH ?? null,
              item.layerIndex,
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
      const outfitIds = rows.map((row) => String(row.id));
      const previewMap = await this.fetchPreviewItems(client, outfitIds);

      return {
        items: rows.map((row) => ({
          id: String(row.id),
          userId: String(row.user_id),
          sourceType: String(row.source_type),
          createdAt: toDate(row.created_at as Date | string),
          updatedAt: toDate(row.updated_at as Date | string),
          coverImageUrl: sanitizeImageUrl((row.cover_image_url as string | null) ?? null),
          itemCount: Number(row.item_count ?? 0),
          previewItems: previewMap.get(String(row.id)) || []
        })),
        total
      };
    });
  }

  async deleteOutfit(userId: string, savedOutfitId: string): Promise<boolean> {
    return withClient(async (client) => {
      await client.query("START TRANSACTION");
      try {
        const [rows] = await client.query<RowDataPacket[]>(
          `SELECT id FROM saved_outfits WHERE id = ? AND user_id = ? LIMIT 1`,
          [savedOutfitId, userId]
        );
        if (rows.length === 0) {
          await client.query("ROLLBACK");
          return false;
        }

        await client.query(
          `DELETE FROM saved_outfit_items WHERE saved_outfit_id = ?`,
          [savedOutfitId]
        );
        const [result] = await client.query<ResultSetHeader>(
          `DELETE FROM saved_outfits WHERE id = ? AND user_id = ?`,
          [savedOutfitId, userId]
        );
        await client.query("COMMIT");
        return Number(result.affectedRows || 0) > 0;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });
  }

  private async fetchPreviewItems(
    client: Parameters<typeof withClient>[0] extends (client: infer T) => Promise<unknown> ? T : never,
    outfitIds: string[]
  ): Promise<Map<string, SavedOutfitPreviewItemRecord[]>> {
    const grouped = new Map<string, SavedOutfitPreviewItemRecord[]>();
    if (outfitIds.length === 0) {
      return grouped;
    }

    const placeholders = outfitIds.map(() => "?").join(", ");
    const [previewRows] = await client.query<RowDataPacket[]>(
      `SELECT soi.saved_outfit_id,
              soi.item_id,
              soi.slot_code,
              soi.sort_order,
              soi.layout_x,
              soi.layout_y,
              soi.layout_w,
              soi.layout_h,
              soi.layer_index,
              ci.image_original_url,
              ci.category,
              ci.sub_category
       FROM saved_outfit_items soi
       LEFT JOIN clothing_items ci ON ci.id = soi.item_id
       WHERE soi.saved_outfit_id IN (${placeholders})`,
      outfitIds
    );

    previewRows.forEach((row) => {
      const savedOutfitId = String(row.saved_outfit_id);
      const current = grouped.get(savedOutfitId) || [];
      current.push({
        itemId: String(row.item_id),
        slotCode: String(row.slot_code),
        sortOrder: Number(row.sort_order ?? 0),
        imageOriginalUrl: sanitizeImageUrl((row.image_original_url as string | null) ?? null),
        category: row.category ? String(row.category) : undefined,
        subCategory: row.sub_category ? String(row.sub_category) : undefined,
        layoutX: toOptionalNumber(row.layout_x),
        layoutY: toOptionalNumber(row.layout_y),
        layoutW: toOptionalNumber(row.layout_w),
        layoutH: toOptionalNumber(row.layout_h),
        layerIndex: toOptionalNumber(row.layer_index)
      });
      grouped.set(savedOutfitId, current);
    });

    grouped.forEach((items, key) => {
      grouped.set(key, sortPreviewItems(items));
    });

    return grouped;
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

function toOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function sortPreviewItems(items: SavedOutfitPreviewItemRecord[]): SavedOutfitPreviewItemRecord[] {
  const slotPriority: Record<string, number> = {
    outer: 1,
    dress: 2,
    top: 3,
    bottom: 4,
    shoes: 5,
    bag: 6,
    accessories: 7
  };

  return [...items].sort((a, b) => {
    const slotDiff = (slotPriority[a.slotCode] || 99) - (slotPriority[b.slotCode] || 99);
    if (slotDiff !== 0) {
      return slotDiff;
    }
    return a.sortOrder - b.sortOrder;
  });
}
