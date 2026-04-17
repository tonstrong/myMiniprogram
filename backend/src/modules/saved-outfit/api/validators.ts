import {
  createObjectValidator,
  objectField,
  optionalNumber,
  optionalObjectField,
  optionalString,
  optionalStringArray,
  requiredString,
  requiredStringEnum
} from "../../../app/common/validation";
import type { FieldValidator, ValidationIssue, Validator } from "../../../app/common/validation";
import type {
  SaveSavedOutfitLayoutItemDTO,
  SaveSavedOutfitRequestDTO,
  SaveSavedOutfitSlotsDTO,
  SavedOutfitListQueryDTO
} from "./dtos";

export const validateSaveSavedOutfitSlots =
  createObjectValidator<SaveSavedOutfitSlotsDTO>({
    top: optionalString({ minLength: 1 }),
    bottom: optionalString({ minLength: 1 }),
    dress: optionalString({ minLength: 1 }),
    outer: optionalString({ minLength: 1 }),
    shoes: optionalString({ minLength: 1 }),
    bag: optionalString({ minLength: 1 }),
    accessories: optionalStringArray({ minLength: 1, maxItems: 20 })
  });

export const validateSaveSavedOutfitLayoutItem =
  createObjectValidator<SaveSavedOutfitLayoutItemDTO>({
    itemId: requiredString({ minLength: 1 }),
    slotCode: optionalString({ minLength: 1 }),
    x: optionalNumber({ min: 0, max: 1 }),
    y: optionalNumber({ min: 0, max: 1 }),
    w: optionalNumber({ min: 0.05, max: 1 }),
    h: optionalNumber({ min: 0.05, max: 1 }),
    layerIndex: optionalNumber({ integer: true, min: 0, max: 99 })
  });

const validateLayoutItemsField: FieldValidator = (value, path) => {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return [{ path, message: "Expected array", code: "type" }];
  }
  if (value.length === 0) {
    return [{ path, message: "Must contain at least 1 item", code: "value" }];
  }
  if (value.length > 8) {
    return [{ path, message: "Must contain at most 8 items", code: "value" }];
  }

  const errors: ValidationIssue[] = [];
  value.forEach((item, index) => {
    const result = validateSaveSavedOutfitLayoutItem(item);
    if (!result.ok) {
      result.errors.forEach((error) => {
        errors.push({
          ...error,
          path: error.path ? `${path}[${index}].${error.path}` : `${path}[${index}]`
        });
      });
    }
  });

  return errors;
};

const baseSaveSavedOutfitRequestValidator =
  createObjectValidator<SaveSavedOutfitRequestDTO>({
    sourceType: requiredStringEnum(["canvas"]),
    slots: optionalObjectField(validateSaveSavedOutfitSlots),
    layoutItems: validateLayoutItemsField
  });

export const validateSaveSavedOutfitRequest: Validator<SaveSavedOutfitRequestDTO> = (input) => {
  const result = baseSaveSavedOutfitRequestValidator(input);
  if (!result.ok) {
    return result;
  }

  const hasLayoutItems = Array.isArray(result.value.layoutItems) && result.value.layoutItems.length > 0;
  const hasSlots = !!result.value.slots && Object.values(result.value.slots).some((value) => {
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return typeof value === "string" && value.length > 0;
  });

  if (!hasLayoutItems && !hasSlots) {
    return {
      ok: false,
      errors: [{ path: "layoutItems", message: "Provide layoutItems or slots", code: "required" }]
    };
  }

  return result;
};

export const validateSavedOutfitListQuery =
  createObjectValidator<SavedOutfitListQueryDTO>({
    pageNo: optionalNumber({ integer: true, min: 1 }),
    pageSize: optionalNumber({ integer: true, min: 1, max: 200 })
  });

export const validateSavedOutfitIdParams = createObjectValidator<{ savedOutfitId: string }>({
  savedOutfitId: requiredString({ minLength: 1 })
});
