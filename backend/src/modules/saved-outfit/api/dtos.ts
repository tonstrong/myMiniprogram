export interface SaveSavedOutfitSlotsDTO {
  top?: string;
  bottom?: string;
  dress?: string;
  outer?: string;
  shoes?: string;
  bag?: string;
  accessories?: string[];
}

export interface SaveSavedOutfitRequestDTO {
  sourceType: "canvas";
  slots: SaveSavedOutfitSlotsDTO;
}

export interface SaveSavedOutfitResponseDTO {
  savedOutfitId: string;
  createdAt: string;
}

export interface SavedOutfitListQueryDTO {
  pageNo?: number;
  pageSize?: number;
}

export interface SavedOutfitListItemDTO {
  savedOutfitId: string;
  sourceType: string;
  createdAt: string;
  coverImageUrl?: string;
  itemCount: number;
}
