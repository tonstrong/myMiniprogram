import type { ModuleRegistration } from "../../app/common/types";

export function registerFileStorageModule(): ModuleRegistration {
  return {
    name: "file-storage",
    init: (context) => {
      context.logger.info("File storage module initialized (placeholder)");
    }
  };
}
