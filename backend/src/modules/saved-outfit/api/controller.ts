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
import type { SaveSavedOutfitRequestDTO, SaveSavedOutfitResponseDTO } from "./dtos";
import { SavedOutfitRoutes } from "./index";
import { validateSaveSavedOutfitRequest } from "./validators";

export interface SavedOutfitControllerDependencies {
  savedOutfitService: SavedOutfitService;
}

export class SavedOutfitController {
  constructor(private readonly deps: SavedOutfitControllerDependencies) {}

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
}

export function createSavedOutfitControllerRoutes(
  controller: SavedOutfitController
): ApiRouteDefinition[] {
  return [
    {
      ...parseRoute(SavedOutfitRoutes.save),
      summary: "Save outfit canvas as formal outfit record",
      handler: controller.save.bind(controller)
    }
  ];
}
