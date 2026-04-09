import type {
  PaginatedResult,
  PaginationQuery,
  ProviderMeta,
  TaskStatus
} from "../../../app/common/types";

export type ClothingItemStatus =
  | "uploaded"
  | "needs_review"
  | "active"
  | "archived"
  | "deleted";

export interface ClothingAttributes {
  category?: string;
  subCategory?: string;
  colors?: string[];
  pattern?: string;
  material?: string;
  fit?: string[];
  length?: string;
  seasons?: string[];
  tags?: string[];
  occasionTags?: string[];
  confidence?: Record<string, number>;
}

export interface UploadClothingItemCommand {
  userId: string;
  sourceType: "camera" | "album";
  fileId?: string;
  originalFilename?: string;
}

export interface UploadClothingItemResult {
  itemId: string;
  taskId: string;
  status: TaskStatus;
}

export interface ClothingItemSummary {
  itemId: string;
  category?: string;
  subCategory?: string;
  colors?: string[];
  tags?: string[];
  status: ClothingItemStatus;
  imageOriginalUrl?: string;
  updatedAt?: string;
}

export interface ClothingItemDetail {
  itemId: string;
  status: ClothingItemStatus;
  imageOriginalUrl?: string;
  attributes: ClothingAttributes;
  providerMeta?: ProviderMeta & { confidence?: Record<string, number> };
}

export interface UpdateClothingItemCommand {
  itemId: string;
  userId: string;
  attributes: Partial<ClothingAttributes>;
}

export interface ConfirmClothingItemCommand {
  itemId: string;
  userId: string;
}

export interface ClosetQueryFilters extends PaginationQuery {
  category?: string;
  season?: string;
  tag?: string;
  status?: ClothingItemStatus;
}

export interface ClosetService {
  uploadItem(command: UploadClothingItemCommand): Promise<UploadClothingItemResult>;
  listItems(
    userId: string,
    query: ClosetQueryFilters
  ): Promise<PaginatedResult<ClothingItemSummary>>;
  getItem(userId: string, itemId: string): Promise<ClothingItemDetail>;
  updateItem(command: UpdateClothingItemCommand): Promise<ClothingItemDetail>;
  confirmItem(command: ConfirmClothingItemCommand): Promise<ClothingItemDetail>;
  archiveItem(userId: string, itemId: string): Promise<void>;
  deleteItem(userId: string, itemId: string): Promise<void>;
}
