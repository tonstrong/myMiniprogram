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
    }
  ) {
    this.client = new OpenAI({
      baseURL: config.baseUrl,
      apiKey: config.apiKey,
    });
  }

  async call(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const messages = (payload.messages as any[]) || [];
    const responseSchema = payload.response_format as any;

    const options: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
      model: this.config.model,
      messages: messages,
      temperature: (payload.temperature as number) ?? 0,
      response_format: responseSchema,
    };

    try {
      const completion = await this.client.chat.completions.create(options);
      const choice = completion.choices[0];

      return {
        output: choice.message.content || "",
        finish_reason: choice.finish_reason,
        usage: completion.usage,
      };
    } catch (error: any) {
      throw new Error(`OpenAI Adapter (${this.name}) error: ${error.message}`);
    }
  }
}
