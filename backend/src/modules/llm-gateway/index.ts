import type { ModuleRegistration } from "../../app/common/types";

export * from "./api";
export * from "./application";

export function registerLlmGatewayModule(): ModuleRegistration {
  return {
    name: "llm-gateway",
    init: (context) => {
      context.logger.info("LLM gateway module initialized (placeholder)");
    }
  };
}
