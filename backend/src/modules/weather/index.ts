import type { ModuleRegistration } from "../../app/common/types";

export * from "./api";
export * from "./application";
export * from "./infrastructure";

export function registerWeatherModule(): ModuleRegistration {
  return {
    name: "weather",
    init: (context) => {
      context.logger.info("Weather module initialized");
    }
  };
}
