import type { ModuleRegistration } from "../../app/common/types";

export function registerClosetModule(): ModuleRegistration {
  return {
    name: "closet",
    init: (context) => {
      context.logger.info("Closet module initialized (placeholder)");
    }
  };
}
