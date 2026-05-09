import type { 
  LlmGatewayRequest, 
  LlmGatewayResponse, 
  LlmGatewayService 
} from "./index";
import type { LlmProviderAdapter } from "../infrastructure";
import { OpenAIAdapter } from "../infrastructure/adapters/openai-adapter";
import { loadConfig } from "../../../app/config";

export class LlmGatewayServiceImpl implements LlmGatewayService {
  private readonly adapters: Map<string, LlmProviderAdapter> = new Map();

  constructor() {
    this.initializeAdapters();
  }

  private initializeAdapters() {
    const config = loadConfig();
    for (const provider of config.llm.providers) {
      // For now, we assume all providers follow OpenAI compatible API
      // Since DashScope, DeepSeek, and OpenAI all do.
      const adapter = new OpenAIAdapter(provider.name, {
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: provider.model,
        timeoutMs: config.llm.timeoutMs,
      });
      this.adapters.set(provider.name, adapter);
    }
  }

  async invoke(request: LlmGatewayRequest): Promise<LlmGatewayResponse> {
    const config = loadConfig();
    const providers = config.llm.providers;

    if (providers.length === 0) {
      throw new Error("No LLM providers configured");
    }

    // Simple routing: use the first available provider or the hinted one
    const requestedProvider = request.providerHint || providers[0].name;
    const providerNames = [
      requestedProvider,
      ...providers.map((provider) => provider.name).filter((name) => name !== requestedProvider)
    ];

    const payload = this.preparePayload(request);
    const startedAt = Date.now();
    let lastError: Error | undefined;

    for (const [index, providerName] of providerNames.entries()) {
      const adapter = this.adapters.get(providerName);
      const provider = providers.find((item) => item.name === providerName);

      if (!adapter || !provider) {
        lastError = new Error(`Provider ${providerName} not found or not initialized`);
        continue;
      }

      try {
        const result = await adapter.call(payload);
        const rawText = typeof result.output === "string" ? result.output : undefined;

        return {
          output: rawText ? { text: rawText } : ((result.output as Record<string, unknown>) ?? {}),
          rawText,
          providerMeta: {
            provider: adapter.name,
            modelName: provider.model || "unknown",
            modelTier: request.modelTier ?? provider.modelTier,
            retryCount: 0,
            fallbackUsed: index > 0,
            latencyMs: Date.now() - startedAt,
          }
        };
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw new Error(
      `LLM Gateway invocation failed for ${requestedProvider}: ${lastError?.message ?? "unknown error"}`
    );
  }

  private preparePayload(request: LlmGatewayRequest): Record<string, unknown> {
    // Basic mapping: input contains the messages or prompt
    // This should ideally use task-specific templates
    const messages = request.input.messages || [
      { role: "user", content: JSON.stringify(request.input) }
    ];

    return {
      messages,
      temperature: request.input.temperature ?? 0,
      response_format: request.outputSchema ? { type: "json_object" } : undefined,
    };
  }
}
