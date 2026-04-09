import type { ModuleRegistration } from "../../app/common/types";

export function registerUserProfileModule(): ModuleRegistration {
  return {
    name: "user-profile",
    init: (context) => {
      context.logger.info("User profile module initialized (placeholder)");
    }
  };
}
