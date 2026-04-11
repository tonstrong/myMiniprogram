import type { ModuleRegistration } from "../../app/common/types";
import { LlmGatewayServiceImpl } from "./application/gateway-service-impl";

export * from "./api";
export * from "./application";

export function registerLlmGatewayModule(): ModuleRegistration {
  return {
    name: "llm-gateway",
    init: (context) => {
      // Current bootstrap context does not expose a DI container yet.
      // Keep module initialization side-effect free until container wiring exists.
      new LlmGatewayServiceImpl();
      context.logger.info("LLM gateway module initialized");
    }
  };
}
