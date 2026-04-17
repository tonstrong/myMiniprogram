import type { ModuleRegistration } from "../../app/common/types";

export * from "./api";
export * from "./application";
export * from "./infrastructure";

export function registerSavedOutfitModule(): ModuleRegistration {
  return {
    name: "saved-outfit",
    init: (context) => {
      context.logger.info("Saved outfit module initialized");
    }
  };
}
