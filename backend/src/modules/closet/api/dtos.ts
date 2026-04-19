import type { ProviderMeta, TaskStatus } from "../../../app/common/types";

export type ClothingItemStatusDTO =
  | "uploaded"
  | "needs_review"
  | "active"
  | "archived"
  | "deleted";

export type UploadSourceType = "camera" | "album";

export interface UploadClothingItemRequestDTO {
  sourceType: UploadSourceType;
  fileId?: string;
  fileContentBase64?: string;
  fileContentType?: string;
  originalFilename?: string;
}

export interface GetClothingItemImageQueryDTO {
  userId: string;
  key: string;
}

export interface UploadClothingItemResponseDTO {
  itemId: string;
  taskId?: string;
  status: TaskStatus | ClothingItemStatusDTO;
}

export interface ClothingItemListQueryDTO {
  category?: string;
  season?: string;
  tag?: string;
  status?: ClothingItemStatusDTO;
  pageNo?: number;
  pageSize?: number;
}

export interface ClothingItemListItemDTO {
  itemId: string;
  category?: string;
  subCategory?: string;
  colors?: string[];
  tags?: string[];
  status: ClothingItemStatusDTO;
  imageOriginalUrl?: string;
  updatedAt?: string;
}

export interface ClothingAttributesDTO {
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

export interface ClothingItemLlmMetaDTO extends ProviderMeta {
  confidence?: Record<string, number>;
}

export interface AiExtractionQuotaDTO {
  usedCount: number;
  dailyLimit: number;
  remainingCount?: number;
  unlimited: boolean;
}

export interface ClothingItemDetailResponseDTO {
  itemId: string;
  status: ClothingItemStatusDTO;
  imageOriginalUrl?: string;
  attributes: ClothingAttributesDTO;
  llmMeta?: ClothingItemLlmMetaDTO;
  aiQuota?: AiExtractionQuotaDTO;
}

export interface ExtractClothingItemRequestDTO {
  recognitionType?: "clothes" | "jewelry";
  engine?: "auto" | "fashion_clip" | "clip" | "rules";
}

export interface UpdateClothingItemRequestDTO {
  category?: string;
  subCategory?: string;
  colors?: string[];
  material?: string;
  fit?: string[];
  length?: string;
  seasons?: string[];
  tags?: string[];
  occasionTags?: string[];
}

export interface ConfirmClothingItemRequestDTO {
  confirmedBy?: string;
  confirmedAt?: string;
}

export interface PreviewClothingItemCutoutRequestDTO {
  recognitionType?: "clothes" | "jewelry";
  engine?: "auto" | "rembg" | "classic";
  keepCanvas?: boolean;
  saveMask?: boolean;
  sourceImageBase64?: string;
  sourceContentType?: string;
  sourceFilename?: string;
}

export interface ApplyClothingItemCutoutRequestDTO {
  imageBase64: string;
  contentType: string;
  filename?: string;
}

export interface ClothingItemCutoutPreviewResponseDTO {
  itemId: string;
  previewImageBase64: string;
  previewContentType: string;
  previewFilename: string;
  engineRequested: string;
  engineUsed: string;
  transparentBackground: boolean;
}
