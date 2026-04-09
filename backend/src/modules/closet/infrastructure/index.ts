import type {
  ClothingItemAttributeHistoryRecord,
  ClothingItemRecord
} from "./persistence";

export interface ClosetRepository {
  saveItem(item: ClothingItemRecord): Promise<void>;
  updateItem(id: string, patch: Partial<ClothingItemRecord>): Promise<void>;
  findItemById(id: string): Promise<ClothingItemRecord | null>;
  appendAttributeHistory(
    entry: ClothingItemAttributeHistoryRecord
  ): Promise<void>;
}
