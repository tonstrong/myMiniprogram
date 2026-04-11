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
  publicBaseUrl: string;
  maxUploadBytes: number;
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

function requireEnvAny(keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key];
    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required env var. Tried: ${keys.join(", ")}`);
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
    const legacyNormalized = normalized.replace(/^PROVIDER_/, "");
    const priority = priorityList.indexOf(name);

    return {
      name,
      baseUrl: requireEnvAny([
        `LLM_PROVIDER_${normalized}_BASE_URL`,
        `LLM_PROVIDER_${legacyNormalized}_BASE_URL`
      ]),
      apiKey: requireEnvAny([
        `LLM_PROVIDER_${normalized}_API_KEY`,
        `LLM_PROVIDER_${legacyNormalized}_API_KEY`
      ]),
      model: requireEnvAny([
        `LLM_PROVIDER_${normalized}_MODEL`,
        `LLM_PROVIDER_${legacyNormalized}_MODEL`
      ]),
      priority: priority === -1 ? 999 : priority
    };
  });
}

export function loadConfig(): AppConfig {
  dotenv.config();

  const port = Number(optionalEnv("APP_PORT", "4000"));

  return {
    env: optionalEnv("APP_ENV", "development"),
    port,
    publicBaseUrl: optionalEnv("PUBLIC_BASE_URL", `http://127.0.0.1:${port}`),
    maxUploadBytes: Number(optionalEnv("MAX_UPLOAD_BYTES", "10485760")),
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
