import type { ModuleRegistration } from "../../app/common/types";

export * from "./api";
export * from "./application";

export function registerStylePackModule(): ModuleRegistration {
  return {
    name: "style-pack",
    init: (context) => {
      context.logger.info("Style pack module initialized (placeholder)");
    }
  };
}
