import type { BaseRecord, CreatedAtRecord } from "../../../app/common/persistence";

export interface SavedOutfitRecord extends BaseRecord {
  userId: string;
  sourceType: string;
  coverItemId?: string | null;
}

export interface SavedOutfitItemRecord extends CreatedAtRecord {
  id: string;
  savedOutfitId: string;
  itemId: string;
  slotCode: string;
  sortOrder: number;
}
