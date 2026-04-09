import type { ModuleRegistration } from "../../app/common/types";

export * from "./api";
export * from "./application";

export function registerTaskCenterModule(): ModuleRegistration {
  return {
    name: "task-center",
    init: (context) => {
      context.logger.info("Task center module initialized (placeholder)");
    }
  };
}
