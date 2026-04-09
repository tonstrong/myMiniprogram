import dotenv from "dotenv";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LlmProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  priority: number;
}

export interface AppConfig {
  env: string;
  port: number;
  logLevel: LogLevel;
  databaseUrl: string;
  queueUrl: string;
  storage: {
    provider: string;
    bucket: string;
  };
  llm: {
    providers: LlmProviderConfig[];
    timeoutMs: number;
    retryLimit: number;
  };
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

function parseProviderList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildProviders(): LlmProviderConfig[] {
  const providers = parseProviderList(optionalEnv("LLM_PROVIDERS", ""));
  const priorityList = parseProviderList(optionalEnv("LLM_PROVIDER_PRIORITY", ""));

  return providers.map((name) => {
    const normalized = name.toUpperCase().replace(/-/g, "_");
    const priority = priorityList.indexOf(name);

    return {
      name,
      baseUrl: requireEnv(`LLM_PROVIDER_${normalized}_BASE_URL`),
      apiKey: requireEnv(`LLM_PROVIDER_${normalized}_API_KEY`),
      model: requireEnv(`LLM_PROVIDER_${normalized}_MODEL`),
      priority: priority === -1 ? 999 : priority
    };
  });
}

export function loadConfig(): AppConfig {
  dotenv.config();

  return {
    env: optionalEnv("APP_ENV", "development"),
    port: Number(optionalEnv("APP_PORT", "4000")),
    logLevel: (optionalEnv("LOG_LEVEL", "info") as LogLevel) || "info",
    databaseUrl: requireEnv("DATABASE_URL"),
    queueUrl: requireEnv("QUEUE_URL"),
    storage: {
      provider: optionalEnv("STORAGE_PROVIDER", "local"),
      bucket: optionalEnv("STORAGE_BUCKET", "closet-assets")
    },
    llm: {
      providers: buildProviders(),
      timeoutMs: Number(optionalEnv("LLM_PROVIDER_TIMEOUT_MS", "20000")),
      retryLimit: Number(optionalEnv("LLM_PROVIDER_RETRY_LIMIT", "2"))
    }
  };
}
