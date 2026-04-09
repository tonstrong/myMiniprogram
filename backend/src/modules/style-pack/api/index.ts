export * from "./dtos";

export const StylePackRoutes = {
  importText: "POST /api/style-packs/import/text",
  importVideo: "POST /api/style-packs/import/video",
  listPacks: "GET /api/style-packs",
  getPack: "GET /api/style-packs/:stylePackId",
  updatePack: "PUT /api/style-packs/:stylePackId",
  activate: "POST /api/style-packs/:stylePackId/activate",
  deactivate: "POST /api/style-packs/:stylePackId/deactivate"
};
