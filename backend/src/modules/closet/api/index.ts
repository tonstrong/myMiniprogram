export * from "./dtos";
export * from "./controller";
export * from "./validators";

export const ClosetRoutes = {
  uploadItem: "POST /api/closet/items/upload",
  listItems: "GET /api/closet/items",
  getItem: "GET /api/closet/items/:itemId",
  getItemImage: "GET /api/closet/items/:itemId/image",
  updateItem: "PUT /api/closet/items/:itemId",
  confirmItem: "POST /api/closet/items/:itemId/confirm",
  archiveItem: "POST /api/closet/items/:itemId/archive",
  deleteItem: "DELETE /api/closet/items/:itemId"
};
