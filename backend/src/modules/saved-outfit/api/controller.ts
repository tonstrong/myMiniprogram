import {
  fail,
  formatValidationErrors,
  ok,
  parseRoute,
  validateRequest
} from "../../../app/common";
import type { ApiRequest, ApiRouteDefinition } from "../../../app/common";
import type { ApiResponse } from "../../../app/common/response";
import type { SavedOutfitService } from "../application";
import type {
  DeleteSavedOutfitResponseDTO,
  SaveSavedOutfitRequestDTO,
  SaveSavedOutfitResponseDTO,
  SavedOutfitListItemDTO,
  SavedOutfitListQueryDTO
} from "./dtos";
import { SavedOutfitRoutes } from "./index";
import {
  validateSaveSavedOutfitRequest,
  validateSavedOutfitIdParams,
  validateSavedOutfitListQuery
} from "./validators";

export interface SavedOutfitControllerDependencies {
  savedOutfitService: SavedOutfitService;
}

export interface SavedOutfitIdParams {
  savedOutfitId: string;
}

export class SavedOutfitController {
  constructor(private readonly deps: SavedOutfitControllerDependencies) {}

  async list(
    request: ApiRequest<unknown, SavedOutfitListQueryDTO>
  ): Promise<ApiResponse<{ items: SavedOutfitListItemDTO[]; pageNo: number; pageSize: number; total: number }>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const validation = validateRequest(request.query, validateSavedOutfitListQuery);
    if (!validation.ok) {
      return fail("INVALID_REQUEST", formatValidationErrors(validation.errors));
    }

    const result = await this.deps.savedOutfitService.list(userId, {
      pageNo: validation.value.pageNo,
      pageSize: validation.value.pageSize
    });

    return ok(result);
  }

  async save(
    request: ApiRequest<SaveSavedOutfitRequestDTO>
  ): Promise<ApiResponse<SaveSavedOutfitResponseDTO>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const validation = validateRequest(request.body, validateSaveSavedOutfitRequest);
    if (!validation.ok) {
      return fail("INVALID_REQUEST", formatValidationErrors(validation.errors));
    }

    const result = await this.deps.savedOutfitService.save({
      userId,
      sourceType: validation.value.sourceType,
      slots: validation.value.slots
    });

    return ok(result);
  }

  async delete(
    request: ApiRequest<unknown, unknown, SavedOutfitIdParams>
  ): Promise<ApiResponse<DeleteSavedOutfitResponseDTO>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const paramValidation = validateRequest(request.params, validateSavedOutfitIdParams);
    if (!paramValidation.ok) {
      return fail("INVALID_REQUEST", formatValidationErrors(paramValidation.errors));
    }

    await this.deps.savedOutfitService.delete(userId, paramValidation.value.savedOutfitId);
    return ok({ savedOutfitId: paramValidation.value.savedOutfitId });
  }
}

export function createSavedOutfitControllerRoutes(
  controller: SavedOutfitController
): ApiRouteDefinition[] {
  return [
    {
      ...parseRoute(SavedOutfitRoutes.list),
      summary: "List saved outfits",
      handler: controller.list.bind(controller)
    },
    {
      ...parseRoute(SavedOutfitRoutes.save),
      summary: "Save outfit canvas as formal outfit record",
      handler: controller.save.bind(controller)
    },
    {
      ...parseRoute(SavedOutfitRoutes.delete),
      summary: "Delete saved outfit",
      handler: controller.delete.bind(controller)
    }
  ];
}
