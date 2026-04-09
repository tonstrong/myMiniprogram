import { createLogger, Logger } from "../common/logger";
import { AppConfig } from "../config";

export interface AppContext {
  config: AppConfig;
  logger: Logger;
}

export function createAppContext(config: AppConfig): AppContext {
  return {
    config,
    logger: createLogger(config.logLevel)
  };
}
