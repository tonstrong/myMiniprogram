export interface SaveSavedOutfitSlotsDTO {
  top?: string;
  bottom?: string;
  dress?: string;
  outer?: string;
  shoes?: string;
  bag?: string;
  accessories?: string[];
}

export interface SaveSavedOutfitLayoutItemDTO {
  itemId: string;
  slotCode?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  layerIndex?: number;
}

export interface SaveSavedOutfitRequestDTO {
  sourceType: "canvas";
  slots?: SaveSavedOutfitSlotsDTO;
  layoutItems?: SaveSavedOutfitLayoutItemDTO[];
}

export interface SaveSavedOutfitResponseDTO {
  savedOutfitId: string;
  createdAt: string;
}

export interface DeleteSavedOutfitResponseDTO {
  savedOutfitId: string;
}

export interface SavedOutfitListQueryDTO {
  pageNo?: number;
  pageSize?: number;
}

export interface SavedOutfitPreviewItemDTO {
  itemId: string;
  slotCode: string;
  sortOrder: number;
  imageUrl?: string;
  category?: string;
  subCategory?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  layerIndex?: number;
}

export interface SavedOutfitListItemDTO {
  savedOutfitId: string;
  sourceType: string;
  createdAt: string;
  coverImageUrl?: string;
  itemCount: number;
  previewItems: SavedOutfitPreviewItemDTO[];
}
