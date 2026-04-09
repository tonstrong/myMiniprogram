export * from "./dtos";

export const ClosetRoutes = {
  uploadItem: "POST /api/closet/items/upload",
  listItems: "GET /api/closet/items",
  getItem: "GET /api/closet/items/:itemId",
  updateItem: "PUT /api/closet/items/:itemId",
  confirmItem: "POST /api/closet/items/:itemId/confirm",
  archiveItem: "POST /api/closet/items/:itemId/archive",
  deleteItem: "DELETE /api/closet/items/:itemId"
};
