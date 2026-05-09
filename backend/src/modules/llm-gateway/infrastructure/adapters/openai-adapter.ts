import OpenAI from "openai";
import type { LlmProviderAdapter } from "../index";

export class OpenAIAdapter implements LlmProviderAdapter {
  private readonly client: OpenAI;

  constructor(
    public readonly name: string,
    private readonly config: {
      baseUrl: string;
      apiKey: string;
      model: string;
      timeoutMs?: number;
    }
  ) {
    this.client = new OpenAI({
      baseURL: normalizeOpenAICompatibleBaseUrl(config.baseUrl),
      apiKey: config.apiKey,
      timeout: config.timeoutMs,
    });
  }

  async call(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const messages = Array.isArray(payload.messages) ? (payload.messages as any[]) : [];
    const responseSchema = payload.response_format as any;

    const options: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
      model: this.config.model,
      messages: messages,
      temperature: (payload.temperature as number) ?? 0,
    };
    if (responseSchema) {
      options.response_format = responseSchema;
    }

    try {
      const completion = await this.client.chat.completions.create(options);
      const choice = completion.choices[0];

      return {
        output: choice.message.content || "",
        finish_reason: choice.finish_reason,
        usage: completion.usage,
      };
    } catch (error: any) {
      throw new Error(`OpenAI Adapter (${this.name}) error: ${formatOpenAIError(error)}`);
    }
  }
}

function formatOpenAIError(error: any): string {
  const status = error?.status ? `HTTP ${error.status}: ` : "";
  const message = error?.message ?? "unknown error";
  const body =
    typeof error?.error === "string"
      ? error.error
      : error?.error && typeof error.error === "object"
        ? JSON.stringify(error.error)
        : "";

  return `${status}${message}${body ? ` ${body}` : ""}`;
}

function normalizeOpenAICompatibleBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return trimmed;
  }

  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}
