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
