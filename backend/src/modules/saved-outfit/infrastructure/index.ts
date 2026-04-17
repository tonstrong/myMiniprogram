import type {
  SavedOutfitItemRecord,
  SavedOutfitListRecord,
  SavedOutfitRecord
} from "./persistence";

export interface SavedOutfitRepository {
  saveOutfit(record: SavedOutfitRecord, items: SavedOutfitItemRecord[]): Promise<void>;
  listByUser(
    userId: string,
    query: { pageNo: number; pageSize: number }
  ): Promise<{ items: SavedOutfitListRecord[]; total: number }>;
  deleteOutfit(userId: string, savedOutfitId: string): Promise<boolean>;
}

export * from "./persistence";
export * from "./repository-adapters";
