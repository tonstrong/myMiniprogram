import {
  fail,
  formatValidationErrors,
  ok,
  parseRoute,
  validateRequest
} from "../../../app/common";
import type { ApiRequest, ApiRouteDefinition, PaginatedResult } from "../../../app/common";
import type { ApiResponse } from "../../../app/common/response";
import type { StylePackDetail, StylePackQuery, StylePackService } from "../application";
import type {
  ImportStylePackTextRequestDTO,
  ImportStylePackVideoRequestDTO,
  StylePackDetailResponseDTO,
  StylePackListItemDTO,
  UpdateStylePackRequestDTO
} from "./dtos";
import { StylePackRoutes } from "./index";
import {
  validateImportStylePackTextRequest,
  validateImportStylePackVideoRequest,
  validateStylePackIdParams,
  validateStylePackQuery,
  validateUpdateStylePackRequest
} from "./validators";

export interface StylePackControllerDependencies {
  stylePackService: StylePackService;
}

export interface StylePackIdParams {
  stylePackId: string;
}

export class StylePackController {
  constructor(private readonly deps: StylePackControllerDependencies) {}

  async importText(
    request: ApiRequest<ImportStylePackTextRequestDTO>
  ): Promise<ApiResponse<StylePackDetailResponseDTO>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const validation = validateRequest(
      request.body,
      validateImportStylePackTextRequest
    );
    if (!validation.ok) {
      return fail("INVALID_REQUEST", formatValidationErrors(validation.errors));
    }

    const detail = await this.deps.stylePackService.importText({
      userId,
      title: validation.value.title,
      text: validation.value.text,
      authConfirmed: validation.value.authConfirmed
    });

    return ok(mapStylePackDetail(detail));
  }

  async importVideo(
    request: ApiRequest<ImportStylePackVideoRequestDTO>
  ): Promise<ApiResponse<StylePackDetailResponseDTO>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const validation = validateRequest(
      request.body,
      validateImportStylePackVideoRequest
    );
    if (!validation.ok) {
      return fail("INVALID_REQUEST", formatValidationErrors(validation.errors));
    }

    const detail = await this.deps.stylePackService.importVideo({
      userId,
      title: validation.value.title,
      fileId: validation.value.fileId,
      authConfirmed: validation.value.authConfirmed
    });

    return ok(mapStylePackDetail(detail));
  }

  async listPacks(
    request: ApiRequest<unknown, StylePackQuery>
  ): Promise<ApiResponse<PaginatedResult<StylePackListItemDTO>>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const queryValidation = validateRequest(
      request.query,
      validateStylePackQuery
    );
    if (!queryValidation.ok) {
      return fail(
        "INVALID_REQUEST",
        formatValidationErrors(queryValidation.errors)
      );
    }

    const result = await this.deps.stylePackService.list(
      userId,
      queryValidation.value
    );

    return ok({
      ...result,
      items: result.items.map((item) => ({
        stylePackId: item.stylePackId,
        name: item.name,
        sourceType: item.sourceType,
        status: item.status,
        version: item.version,
        updatedAt: item.updatedAt
      }))
    });
  }

  async getPack(
    request: ApiRequest<unknown, unknown, StylePackIdParams>
  ): Promise<ApiResponse<StylePackDetailResponseDTO>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const paramValidation = validateRequest(
      request.params,
      validateStylePackIdParams
    );
    if (!paramValidation.ok) {
      return fail(
        "INVALID_REQUEST",
        formatValidationErrors(paramValidation.errors)
      );
    }

    const detail = await this.deps.stylePackService.getDetail(
      userId,
      paramValidation.value.stylePackId
    );

    return ok(mapStylePackDetail(detail));
  }

  async updatePack(
    request: ApiRequest<UpdateStylePackRequestDTO, unknown, StylePackIdParams>
  ): Promise<ApiResponse<StylePackDetailResponseDTO>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const paramValidation = validateRequest(
      request.params,
      validateStylePackIdParams
    );
    if (!paramValidation.ok) {
      return fail(
        "INVALID_REQUEST",
        formatValidationErrors(paramValidation.errors)
      );
    }

    const bodyValidation = validateRequest(
      request.body,
      validateUpdateStylePackRequest
    );
    if (!bodyValidation.ok) {
      return fail(
        "INVALID_REQUEST",
        formatValidationErrors(bodyValidation.errors)
      );
    }

    const detail = await this.deps.stylePackService.update({
      userId,
      stylePackId: paramValidation.value.stylePackId,
      name: bodyValidation.value.name,
      summaryText: bodyValidation.value.summaryText,
      rulesJson: bodyValidation.value.rulesJson,
      promptProfile: bodyValidation.value.promptProfile
    });

    return ok(mapStylePackDetail(detail));
  }

  async activate(
    request: ApiRequest<unknown, unknown, StylePackIdParams>
  ): Promise<ApiResponse<StylePackDetailResponseDTO>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const paramValidation = validateRequest(
      request.params,
      validateStylePackIdParams
    );
    if (!paramValidation.ok) {
      return fail(
        "INVALID_REQUEST",
        formatValidationErrors(paramValidation.errors)
      );
    }

    const detail = await this.deps.stylePackService.activate(
      userId,
      paramValidation.value.stylePackId
    );

    return ok(mapStylePackDetail(detail));
  }

  async deactivate(
    request: ApiRequest<unknown, unknown, StylePackIdParams>
  ): Promise<ApiResponse<StylePackDetailResponseDTO>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const paramValidation = validateRequest(
      request.params,
      validateStylePackIdParams
    );
    if (!paramValidation.ok) {
      return fail(
        "INVALID_REQUEST",
        formatValidationErrors(paramValidation.errors)
      );
    }

    const detail = await this.deps.stylePackService.deactivate(
      userId,
      paramValidation.value.stylePackId
    );

    return ok(mapStylePackDetail(detail));
  }
}

function mapStylePackDetail(detail: StylePackDetail): StylePackDetailResponseDTO {
  return {
    stylePackId: detail.stylePackId,
    name: detail.name,
    sourceType: detail.sourceType as StylePackDetailResponseDTO["sourceType"],
    summaryText: detail.summaryText,
    rulesJson: detail.rulesJson,
    promptProfile: detail.promptProfile,
    providerMeta: detail.providerMeta as StylePackDetailResponseDTO["providerMeta"],
    transcriptText: detail.transcriptText,
    status: detail.status as StylePackDetailResponseDTO["status"],
    version: detail.version,
    updatedAt: detail.updatedAt
  };
}

export function createStylePackControllerRoutes(
  controller: StylePackController
): ApiRouteDefinition[] {
  return [
    {
      ...parseRoute(StylePackRoutes.importText),
      summary: "Import style pack from text",
      handler: controller.importText.bind(controller)
    },
    {
      ...parseRoute(StylePackRoutes.importVideo),
      summary: "Import style pack from video",
      handler: controller.importVideo.bind(controller)
    },
    {
      ...parseRoute(StylePackRoutes.listPacks),
      summary: "List style packs",
      handler: controller.listPacks.bind(controller)
    },
    {
      ...parseRoute(StylePackRoutes.getPack),
      summary: "Get style pack",
      handler: controller.getPack.bind(controller)
    },
    {
      ...parseRoute(StylePackRoutes.updatePack),
      summary: "Update style pack",
      handler: controller.updatePack.bind(controller)
    },
    {
      ...parseRoute(StylePackRoutes.activate),
      summary: "Activate style pack",
      handler: controller.activate.bind(controller)
    },
    {
      ...parseRoute(StylePackRoutes.deactivate),
      summary: "Deactivate style pack",
      handler: controller.deactivate.bind(controller)
    }
  ];
}
