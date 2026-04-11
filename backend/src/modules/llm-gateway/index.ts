import type { ModuleRegistration } from "../../app/common/types";
import { LlmGatewayServiceImpl } from "./application/gateway-service-impl";

export * from "./api";
export * from "./application";

export function registerLlmGatewayModule(): ModuleRegistration {
  return {
    name: "llm-gateway",
    init: (context) => {
      const service = new LlmGatewayServiceImpl();
      context.container.register("llmGatewayService", service);
      context.logger.info("LLM gateway module initialized with DashScope support");
    }
  };
}
