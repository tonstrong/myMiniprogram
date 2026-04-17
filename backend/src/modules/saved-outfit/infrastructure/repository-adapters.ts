import { withClient } from "../../../app/db";
import type { SavedOutfitRepository } from "./index";
import type { SavedOutfitItemRecord, SavedOutfitRecord } from "./persistence";

export class InMemorySavedOutfitRepository implements SavedOutfitRepository {
  private outfits = new Map<string, SavedOutfitRecord>();
  private items = new Map<string, SavedOutfitItemRecord[]>();

  async saveOutfit(record: SavedOutfitRecord, items: SavedOutfitItemRecord[]): Promise<void> {
    this.outfits.set(record.id, record);
    this.items.set(record.id, items);
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
}

export const createMySqlSavedOutfitRepository = (): SavedOutfitRepository =>
  new MySqlSavedOutfitRepository();

function formatDateTime(value: Date): string {
  return value.toISOString().slice(0, 19).replace("T", " ");
}
