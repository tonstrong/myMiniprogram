import type { ModuleRegistration } from "../../app/common/types";

export function registerContentSafetyModule(): ModuleRegistration {
  return {
    name: "content-safety",
    init: (context) => {
      context.logger.info("Content safety module initialized (placeholder)");
    }
  };
}
