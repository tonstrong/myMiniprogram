import {
  fail,
  formatValidationErrors,
  ok,
  parseRoute,
  validateRequest
} from "../../../app/common";
import type { ApiRequest, ApiRouteDefinition, PaginatedResult } from "../../../app/common";
import type { ApiResponse } from "../../../app/common/response";
import type { ClosetService, ClothingAttributes } from "../application";
import type {
  ClothingItemDetailResponseDTO,
  ClothingItemListItemDTO,
  ClothingItemListQueryDTO,
  ConfirmClothingItemRequestDTO,
  UpdateClothingItemRequestDTO,
  UploadClothingItemRequestDTO,
  UploadClothingItemResponseDTO
} from "./dtos";
import { ClosetRoutes } from "./index";
import {
  validateClothingItemListQuery,
  validateConfirmClothingItemRequest,
  validateItemIdParams,
  validateUpdateClothingItemRequest,
  validateUploadClothingItemRequest
} from "./validators";

export interface ClosetControllerDependencies {
  closetService: ClosetService;
}

export interface ItemIdParams {
  itemId: string;
}

export class ClosetController {
  constructor(private readonly deps: ClosetControllerDependencies) {}

  async uploadItem(
    request: ApiRequest<UploadClothingItemRequestDTO>
  ): Promise<ApiResponse<UploadClothingItemResponseDTO>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const validation = validateRequest(
      request.body,
      validateUploadClothingItemRequest
    );
    if (!validation.ok) {
      return fail("INVALID_REQUEST", formatValidationErrors(validation.errors));
    }

    const result = await this.deps.closetService.uploadItem({
      userId,
      sourceType: validation.value.sourceType,
      fileId: validation.value.fileId,
      originalFilename: validation.value.originalFilename
    });

    return ok({
      itemId: result.itemId,
      taskId: result.taskId,
      status: result.status
    });
  }

  async listItems(
    request: ApiRequest<unknown, ClothingItemListQueryDTO>
  ): Promise<ApiResponse<PaginatedResult<ClothingItemListItemDTO>>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const queryValidation = validateRequest(
      request.query,
      validateClothingItemListQuery
    );
    if (!queryValidation.ok) {
      return fail(
        "INVALID_REQUEST",
        formatValidationErrors(queryValidation.errors)
      );
    }

    const result = await this.deps.closetService.listItems(
      userId,
      queryValidation.value
    );

    return ok({
      ...result,
      items: result.items.map((item) => ({
        itemId: item.itemId,
        category: item.category,
        subCategory: item.subCategory,
        colors: item.colors,
        tags: item.tags,
        status: item.status,
        imageOriginalUrl: item.imageOriginalUrl,
        updatedAt: item.updatedAt
      }))
    });
  }

  async getItem(
    request: ApiRequest<unknown, unknown, ItemIdParams>
  ): Promise<ApiResponse<ClothingItemDetailResponseDTO>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const paramValidation = validateRequest(request.params, validateItemIdParams);
    if (!paramValidation.ok) {
      return fail(
        "INVALID_REQUEST",
        formatValidationErrors(paramValidation.errors)
      );
    }

    const detail = await this.deps.closetService.getItem(
      userId,
      paramValidation.value.itemId
    );

    return ok({
      itemId: detail.itemId,
      status: detail.status,
      imageOriginalUrl: detail.imageOriginalUrl,
      attributes: detail.attributes,
      llmMeta: detail.providerMeta
    });
  }

  async updateItem(
    request: ApiRequest<UpdateClothingItemRequestDTO, unknown, ItemIdParams>
  ): Promise<ApiResponse<ClothingItemDetailResponseDTO>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const paramValidation = validateRequest(request.params, validateItemIdParams);
    if (!paramValidation.ok) {
      return fail(
        "INVALID_REQUEST",
        formatValidationErrors(paramValidation.errors)
      );
    }

    const bodyValidation = validateRequest(
      request.body,
      validateUpdateClothingItemRequest
    );
    if (!bodyValidation.ok) {
      return fail(
        "INVALID_REQUEST",
        formatValidationErrors(bodyValidation.errors)
      );
    }

    const attributes: Partial<ClothingAttributes> = {
      category: bodyValidation.value.category,
      subCategory: bodyValidation.value.subCategory,
      colors: bodyValidation.value.colors,
      material: bodyValidation.value.material,
      fit: bodyValidation.value.fit,
      length: bodyValidation.value.length,
      seasons: bodyValidation.value.seasons,
      tags: bodyValidation.value.tags,
      occasionTags: bodyValidation.value.occasionTags
    };

    const detail = await this.deps.closetService.updateItem({
      itemId: paramValidation.value.itemId,
      userId,
      attributes
    });

    return ok({
      itemId: detail.itemId,
      status: detail.status,
      imageOriginalUrl: detail.imageOriginalUrl,
      attributes: detail.attributes,
      llmMeta: detail.providerMeta
    });
  }

  async confirmItem(
    request: ApiRequest<ConfirmClothingItemRequestDTO, unknown, ItemIdParams>
  ): Promise<ApiResponse<ClothingItemDetailResponseDTO>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const paramValidation = validateRequest(request.params, validateItemIdParams);
    if (!paramValidation.ok) {
      return fail(
        "INVALID_REQUEST",
        formatValidationErrors(paramValidation.errors)
      );
    }

    const bodyValidation = validateRequest(
      request.body,
      validateConfirmClothingItemRequest
    );
    if (!bodyValidation.ok) {
      return fail(
        "INVALID_REQUEST",
        formatValidationErrors(bodyValidation.errors)
      );
    }

    const detail = await this.deps.closetService.confirmItem({
      itemId: paramValidation.value.itemId,
      userId
    });

    return ok({
      itemId: detail.itemId,
      status: detail.status,
      imageOriginalUrl: detail.imageOriginalUrl,
      attributes: detail.attributes,
      llmMeta: detail.providerMeta
    });
  }

  async archiveItem(
    request: ApiRequest<unknown, unknown, ItemIdParams>
  ): Promise<ApiResponse<{ itemId: string }>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const paramValidation = validateRequest(request.params, validateItemIdParams);
    if (!paramValidation.ok) {
      return fail(
        "INVALID_REQUEST",
        formatValidationErrors(paramValidation.errors)
      );
    }

    await this.deps.closetService.archiveItem(
      userId,
      paramValidation.value.itemId
    );

    return ok({ itemId: paramValidation.value.itemId });
  }

  async deleteItem(
    request: ApiRequest<unknown, unknown, ItemIdParams>
  ): Promise<ApiResponse<{ itemId: string }>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const paramValidation = validateRequest(request.params, validateItemIdParams);
    if (!paramValidation.ok) {
      return fail(
        "INVALID_REQUEST",
        formatValidationErrors(paramValidation.errors)
      );
    }

    await this.deps.closetService.deleteItem(
      userId,
      paramValidation.value.itemId
    );

    return ok({ itemId: paramValidation.value.itemId });
  }
}

export function createClosetControllerRoutes(
  controller: ClosetController
): ApiRouteDefinition[] {
  return [
    {
      ...parseRoute(ClosetRoutes.uploadItem),
      summary: "Upload clothing item",
      handler: controller.uploadItem.bind(controller)
    },
    {
      ...parseRoute(ClosetRoutes.listItems),
      summary: "List clothing items",
      handler: controller.listItems.bind(controller)
    },
    {
      ...parseRoute(ClosetRoutes.getItem),
      summary: "Get clothing item detail",
      handler: controller.getItem.bind(controller)
    },
    {
      ...parseRoute(ClosetRoutes.updateItem),
      summary: "Update clothing item",
      handler: controller.updateItem.bind(controller)
    },
    {
      ...parseRoute(ClosetRoutes.confirmItem),
      summary: "Confirm clothing item",
      handler: controller.confirmItem.bind(controller)
    },
    {
      ...parseRoute(ClosetRoutes.archiveItem),
      summary: "Archive clothing item",
      handler: controller.archiveItem.bind(controller)
    },
    {
      ...parseRoute(ClosetRoutes.deleteItem),
      summary: "Delete clothing item",
      handler: controller.deleteItem.bind(controller)
    }
  ];
}
