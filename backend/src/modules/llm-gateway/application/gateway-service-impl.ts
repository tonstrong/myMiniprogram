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
    const providerName = request.providerHint || providers[0].name;
    const adapter = this.adapters.get(providerName);

    if (!adapter) {
      throw new Error(`Provider ${providerName} not found or not initialized`);
    }

    // Construct the actual LLM payload from task input
    // This is a simplified version, in a real app this might need a mapper per task type
    const payload = this.preparePayload(request);

    try {
      const result = await adapter.call(payload);
      
      return {
        output: typeof result.output === 'string' ? { text: result.output } : (result.output as any),
        rawText: result.output as string,
        providerMeta: {
          provider: adapter.name,
          model: providers.find(p => p.name === adapter.name)?.model || "unknown",
          latencyMs: 0, // Placeholder
        }
      };
    } catch (error: any) {
      // TODO: Implement retry logic and fallback routing
      throw new Error(`LLM Gateway invocation failed for ${providerName}: ${error.message}`);
    }
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
