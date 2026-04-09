import type { ModuleRegistration } from "../../app/common/types";

export function registerAuthModule(): ModuleRegistration {
  return {
    name: "auth",
    init: (context) => {
      context.logger.info("Auth module initialized (placeholder)");
    }
  };
}
