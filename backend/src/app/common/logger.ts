export interface Logger {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

const levelOrder = ["debug", "info", "warn", "error"] as const;
type Level = (typeof levelOrder)[number];

export function createLogger(level: Level): Logger {
  const minIndex = levelOrder.indexOf(level);
  const shouldLog = (target: Level) => levelOrder.indexOf(target) >= minIndex;

  return {
    debug: (message, meta) => {
      if (shouldLog("debug")) {
        console.debug(message, meta ?? "");
      }
    },
    info: (message, meta) => {
      if (shouldLog("info")) {
        console.info(message, meta ?? "");
      }
    },
    warn: (message, meta) => {
      if (shouldLog("warn")) {
        console.warn(message, meta ?? "");
      }
    },
    error: (message, meta) => {
      if (shouldLog("error")) {
        console.error(message, meta ?? "");
      }
    }
  };
}
