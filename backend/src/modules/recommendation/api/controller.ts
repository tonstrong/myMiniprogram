import {
  fail,
  formatValidationErrors,
  ok,
  parseRoute,
  validateRequest
} from "../../../app/common";
import type { ApiRequest, ApiRouteDefinition } from "../../../app/common";
import type { ApiResponse } from "../../../app/common/response";
import type { RecommendationService } from "../application";
import type {
  GenerateRecommendationRequestDTO,
  GenerateRecommendationResponseDTO,
  RecommendationDetailResponseDTO,
  RecommendationFeedbackRequestDTO
} from "./dtos";
import { RecommendationRoutes } from "./index";
import {
  validateGenerateRecommendationRequest,
  validateRecommendationFeedbackRequest,
  validateRecommendationIdParams
} from "./validators";

export interface RecommendationControllerDependencies {
  recommendationService: RecommendationService;
}

export interface RecommendationIdParams {
  recommendationId: string;
}

export class RecommendationController {
  constructor(private readonly deps: RecommendationControllerDependencies) {}

  async generate(
    request: ApiRequest<GenerateRecommendationRequestDTO>
  ): Promise<ApiResponse<GenerateRecommendationResponseDTO>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const validation = validateRequest(
      request.body,
      validateGenerateRecommendationRequest
    );
    if (!validation.ok) {
      return fail("INVALID_REQUEST", formatValidationErrors(validation.errors));
    }

    const result = await this.deps.recommendationService.generate({
      userId,
      scene: validation.value.scene,
      weather: validation.value.weather,
      stylePackId: validation.value.stylePackId,
      preferenceTags: validation.value.preferenceTags
    });

    return ok({
      recommendationId: result.recommendationId,
      outfits: result.outfits,
      providerMeta: result.providerMeta
    });
  }

  async getDetail(
    request: ApiRequest<unknown, unknown, RecommendationIdParams>
  ): Promise<ApiResponse<RecommendationDetailResponseDTO>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const paramValidation = validateRequest(
      request.params,
      validateRecommendationIdParams
    );
    if (!paramValidation.ok) {
      return fail(
        "INVALID_REQUEST",
        formatValidationErrors(paramValidation.errors)
      );
    }

    const result = await this.deps.recommendationService.getDetail(
      userId,
      paramValidation.value.recommendationId
    );

    return ok({
      recommendationId: result.recommendationId,
      outfits: result.outfits,
      providerMeta: result.providerMeta,
      status: result.status,
      createdAt: result.createdAt
    });
  }

  async feedback(
    request: ApiRequest<RecommendationFeedbackRequestDTO, unknown, RecommendationIdParams>
  ): Promise<ApiResponse<{ recommendationId: string }>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const paramValidation = validateRequest(
      request.params,
      validateRecommendationIdParams
    );
    if (!paramValidation.ok) {
      return fail(
        "INVALID_REQUEST",
        formatValidationErrors(paramValidation.errors)
      );
    }

    const bodyValidation = validateRequest(
      request.body,
      validateRecommendationFeedbackRequest
    );
    if (!bodyValidation.ok) {
      return fail(
        "INVALID_REQUEST",
        formatValidationErrors(bodyValidation.errors)
      );
    }

    await this.deps.recommendationService.feedback({
      userId,
      recommendationId: paramValidation.value.recommendationId,
      action: bodyValidation.value.action,
      reasonTags: bodyValidation.value.reasonTags,
      comment: bodyValidation.value.comment
    });

    return ok({ recommendationId: paramValidation.value.recommendationId });
  }

  async save(
    request: ApiRequest<unknown, unknown, RecommendationIdParams>
  ): Promise<ApiResponse<{ recommendationId: string }>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const paramValidation = validateRequest(
      request.params,
      validateRecommendationIdParams
    );
    if (!paramValidation.ok) {
      return fail(
        "INVALID_REQUEST",
        formatValidationErrors(paramValidation.errors)
      );
    }

    await this.deps.recommendationService.save(
      userId,
      paramValidation.value.recommendationId
    );

    return ok({ recommendationId: paramValidation.value.recommendationId });
  }
}

export function createRecommendationControllerRoutes(
  controller: RecommendationController
): ApiRouteDefinition[] {
  return [
    {
      ...parseRoute(RecommendationRoutes.generate),
      summary: "Generate recommendation",
      handler: controller.generate.bind(controller)
    },
    {
      ...parseRoute(RecommendationRoutes.getDetail),
      summary: "Get recommendation detail",
      handler: controller.getDetail.bind(controller)
    },
    {
      ...parseRoute(RecommendationRoutes.feedback),
      summary: "Submit recommendation feedback",
      handler: controller.feedback.bind(controller)
    },
    {
      ...parseRoute(RecommendationRoutes.save),
      summary: "Save recommendation",
      handler: controller.save.bind(controller)
    }
  ];
}
