import type { BaseRecord, CreatedAtRecord } from "../../../app/common/persistence";

export interface SavedOutfitRecord extends BaseRecord {
  userId: string;
  sourceType: string;
  coverItemId?: string | null;
}

export interface SavedOutfitListRecord {
  id: string;
  userId: string;
  sourceType: string;
  createdAt: Date;
  updatedAt: Date;
  coverImageUrl?: string | null;
  itemCount: number;
  previewItems: SavedOutfitPreviewItemRecord[];
}

export interface SavedOutfitItemRecord extends CreatedAtRecord {
  id: string;
  savedOutfitId: string;
  itemId: string;
  slotCode: string;
  sortOrder: number;
}

export interface SavedOutfitPreviewItemRecord {
  itemId: string;
  slotCode: string;
  sortOrder: number;
  imageOriginalUrl?: string | null;
  category?: string | null;
  subCategory?: string | null;
}
