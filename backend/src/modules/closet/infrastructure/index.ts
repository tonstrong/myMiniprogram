import type {
  ClothingItemImageRecord,
  ClothingItemAttributeHistoryRecord,
  ClothingItemRecord
} from "./persistence";

export interface ClosetRepository {
  saveItem(item: ClothingItemRecord): Promise<void>;
  updateItem(id: string, patch: Partial<ClothingItemRecord>): Promise<void>;
  findItemById(id: string): Promise<ClothingItemRecord | null>;
  listItemsByUserId(userId: string): Promise<ClothingItemRecord[]>;
  saveItemImage(image: ClothingItemImageRecord): Promise<void>;
  findItemImageByItemId(itemId: string): Promise<ClothingItemImageRecord | null>;
  appendAttributeHistory(
    entry: ClothingItemAttributeHistoryRecord
  ): Promise<void>;
}

export * from "./mappers";
export * from "./repository-adapters";
