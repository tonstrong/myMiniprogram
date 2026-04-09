import {
  createObjectValidator,
  optionalNumber,
  optionalRecord,
  optionalString,
  optionalStringEnum,
  requiredBoolean,
  requiredString
} from "../../../app/common/validation";
import type {
  ImportStylePackTextRequestDTO,
  ImportStylePackVideoRequestDTO,
  UpdateStylePackRequestDTO
} from "./dtos";
import type { StylePackQuery } from "../application";
import type { StylePackIdParams } from "./controller";

const stylePackSourceValues = ["text", "video"] as const;
const stylePackStatusValues = [
  "draft",
  "needs_confirm",
  "active",
  "inactive",
  "processing",
  "failed"
] as const;

export const validateImportStylePackTextRequest =
  createObjectValidator<ImportStylePackTextRequestDTO>({
    title: requiredString({ minLength: 1 }),
    text: requiredString({ minLength: 1 }),
    authConfirmed: requiredBoolean()
  });

export const validateImportStylePackVideoRequest =
  createObjectValidator<ImportStylePackVideoRequestDTO>({
    title: requiredString({ minLength: 1 }),
    fileId: optionalString({ minLength: 1 }),
    authConfirmed: requiredBoolean()
  });

export const validateStylePackQuery = createObjectValidator<StylePackQuery>({
  status: optionalStringEnum(stylePackStatusValues),
  sourceType: optionalStringEnum(stylePackSourceValues),
  pageNo: optionalNumber({ min: 1, integer: true }),
  pageSize: optionalNumber({ min: 1, max: 200, integer: true })
});

export const validateUpdateStylePackRequest =
  createObjectValidator<UpdateStylePackRequestDTO>({
    name: optionalString({ minLength: 1 }),
    summaryText: optionalString({ minLength: 1 }),
    rulesJson: optionalRecord(),
    promptProfile: optionalRecord()
  });

export const validateStylePackIdParams =
  createObjectValidator<StylePackIdParams>({
    stylePackId: requiredString({ minLength: 1 })
  });
