import {
  createObjectValidator,
  optionalBoolean,
  optionalNumber,
  optionalString,
  optionalStringArray,
  optionalStringEnum,
  requiredString,
  requiredStringEnum
} from "../../../app/common/validation";
import type {
  ApplyClothingItemCutoutRequestDTO,
  ClothingItemListQueryDTO,
  ConfirmClothingItemRequestDTO,
  ExtractClothingItemRequestDTO,
  GetClothingItemImageQueryDTO,
  PreviewClothingItemCutoutRequestDTO,
  UpdateClothingItemRequestDTO,
  UploadClothingItemRequestDTO
} from "./dtos";
import type { ItemIdParams } from "./controller";

const clothingStatusValues = [
  "uploaded",
  "needs_review",
  "active",
  "archived",
  "deleted"
] as const;

const uploadSourceTypes = ["camera", "album"] as const;
const cutoutEngineValues = ["auto", "rembg", "classic"] as const;
const cutoutRecognitionTypes = ["clothes", "jewelry"] as const;
const attributeEngineValues = ["auto", "fashion_clip", "clip", "rules"] as const;

export const validateUploadClothingItemRequest =
  createObjectValidator<UploadClothingItemRequestDTO>({
    sourceType: requiredStringEnum(uploadSourceTypes),
    fileId: optionalString({ minLength: 1 }),
    fileContentBase64: optionalString({ minLength: 1 }),
    fileContentType: optionalString({ minLength: 1 }),
    originalFilename: optionalString({ minLength: 1 })
  });

export const validateGetClothingItemImageQuery =
  createObjectValidator<GetClothingItemImageQueryDTO>({
    userId: requiredString({ minLength: 1 }),
    key: requiredString({ minLength: 1 })
  });

export const validateClothingItemListQuery =
  createObjectValidator<ClothingItemListQueryDTO>({
    category: optionalString({ minLength: 1 }),
    season: optionalString({ minLength: 1 }),
    tag: optionalString({ minLength: 1 }),
    status: optionalStringEnum(clothingStatusValues),
    pageNo: optionalNumber({ min: 1, integer: true }),
    pageSize: optionalNumber({ min: 1, max: 200, integer: true })
  });

export const validateUpdateClothingItemRequest =
  createObjectValidator<UpdateClothingItemRequestDTO>({
    category: optionalString({ minLength: 1 }),
    subCategory: optionalString({ minLength: 1 }),
    colors: optionalStringArray({ minLength: 1 }),
    material: optionalString({ minLength: 1 }),
    fit: optionalStringArray({ minLength: 1 }),
    length: optionalString({ minLength: 1 }),
    seasons: optionalStringArray({ minLength: 1 }),
    tags: optionalStringArray({ minLength: 1 }),
    occasionTags: optionalStringArray({ minLength: 1 })
  });

export const validateConfirmClothingItemRequest =
  createObjectValidator<ConfirmClothingItemRequestDTO>({
    confirmedBy: optionalString({ minLength: 1 }),
    confirmedAt: optionalString({ minLength: 1 })
  });

export const validateExtractClothingItemRequest =
  createObjectValidator<ExtractClothingItemRequestDTO>({
    recognitionType: optionalStringEnum(cutoutRecognitionTypes),
    engine: optionalStringEnum(attributeEngineValues)
  });

export const validatePreviewClothingItemCutoutRequest =
  createObjectValidator<PreviewClothingItemCutoutRequestDTO>({
    recognitionType: optionalStringEnum(cutoutRecognitionTypes),
    engine: optionalStringEnum(cutoutEngineValues),
    keepCanvas: optionalBoolean(),
    saveMask: optionalBoolean(),
    sourceImageBase64: optionalString({ minLength: 1 }),
    sourceContentType: optionalString({ minLength: 1 }),
    sourceFilename: optionalString({ minLength: 1 })
  });

export const validateApplyClothingItemCutoutRequest =
  createObjectValidator<ApplyClothingItemCutoutRequestDTO>({
    imageBase64: requiredString({ minLength: 1 }),
    contentType: requiredString({ minLength: 1 }),
    filename: optionalString({ minLength: 1 })
  });

export const validateItemIdParams = createObjectValidator<ItemIdParams>({
  itemId: requiredString({ minLength: 1 })
});
