export * from "./dtos";
export * from "./validators";
export * from "./controller";

export const SavedOutfitRoutes = {
  list: "GET /api/saved-outfits",
  save: "POST /api/saved-outfits",
  delete: "DELETE /api/saved-outfits/:savedOutfitId"
};
