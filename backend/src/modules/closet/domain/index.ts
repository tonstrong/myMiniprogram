export interface ClothingItem {
  id: string;
  ownerId: string;
  attributes: Record<string, string | number | boolean>;
}
