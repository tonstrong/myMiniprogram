import type { ModuleRegistration } from "../../app/common/types";

export function registerLlmGatewayModule(): ModuleRegistration {
  return {
    name: "llm-gateway",
    init: (context) => {
      context.logger.info("LLM gateway module initialized (placeholder)");
    }
  };
}
