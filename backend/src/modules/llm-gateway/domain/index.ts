export interface LlmProvider {
  name: string;
  invoke: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
}
