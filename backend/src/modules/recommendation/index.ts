import type { ModuleRegistration } from "../../app/common/types";

export function registerRecommendationModule(): ModuleRegistration {
  return {
    name: "recommendation",
    init: (context) => {
      context.logger.info("Recommendation module initialized (placeholder)");
    }
  };
}
