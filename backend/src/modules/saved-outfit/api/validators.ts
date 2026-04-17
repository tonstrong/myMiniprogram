import {
  createObjectValidator,
  objectField,
  optionalString,
  optionalStringArray,
  requiredStringEnum
} from "../../../app/common/validation";
import type { SaveSavedOutfitRequestDTO, SaveSavedOutfitSlotsDTO } from "./dtos";

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

export const validateSaveSavedOutfitRequest =
  createObjectValidator<SaveSavedOutfitRequestDTO>({
    sourceType: requiredStringEnum(["canvas"]),
    slots: objectField(validateSaveSavedOutfitSlots)
  });
