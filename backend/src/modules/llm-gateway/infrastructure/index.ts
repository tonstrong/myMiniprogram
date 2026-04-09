export interface LlmProviderAdapter {
  name: string;
  call: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
}
