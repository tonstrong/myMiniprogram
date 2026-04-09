import { fail, ok, parseRoute } from "../../../app/common";
import type { ApiRequest, ApiRouteDefinition } from "../../../app/common";
import type { ApiResponse } from "../../../app/common/response";
import type { LlmGatewayService } from "../application";
import type {
  LlmGatewayInvokeRequestDTO,
  LlmGatewayInvokeResponseDTO
} from "./dtos";
import { LlmGatewayRoutes } from "./index";

export interface LlmGatewayControllerDependencies {
  llmGatewayService: LlmGatewayService;
}

export class LlmGatewayController {
  constructor(private readonly deps: LlmGatewayControllerDependencies) {}

  async invoke(
    request: ApiRequest<LlmGatewayInvokeRequestDTO>
  ): Promise<ApiResponse<LlmGatewayInvokeResponseDTO>> {
    if (!request.body?.taskType) {
      return fail("INVALID_REQUEST", "Missing LLM task type");
    }

    const result = await this.deps.llmGatewayService.invoke({
      taskType: request.body.taskType,
      input: request.body.input,
      outputSchema: request.body.outputSchema,
      providerHint: request.body.providerHint,
      modelTier: request.body.modelTier,
      timeoutMs: request.body.timeoutMs,
      retryPolicy: request.body.retryPolicy
    });

    return ok({
      output: result.output,
      providerMeta: result.providerMeta,
      rawText: result.rawText
    });
  }
}

export function createLlmGatewayControllerRoutes(
  controller: LlmGatewayController
): ApiRouteDefinition[] {
  return [
    {
      ...parseRoute(LlmGatewayRoutes.invoke),
      summary: "Invoke LLM gateway (internal)",
      handler: controller.invoke.bind(controller)
    }
  ];
}
