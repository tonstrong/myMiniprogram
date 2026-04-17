import type { SavedOutfitItemRecord, SavedOutfitRecord } from "./persistence";

export interface SavedOutfitRepository {
  saveOutfit(record: SavedOutfitRecord, items: SavedOutfitItemRecord[]): Promise<void>;
}

export * from "./persistence";
export * from "./repository-adapters";
