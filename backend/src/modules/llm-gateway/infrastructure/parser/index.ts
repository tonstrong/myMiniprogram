export interface StructuredOutputParser {
  parse: (payload: unknown) => Record<string, unknown>;
}
