export interface LlmGatewayRequest {
  task: string;
  input: Record<string, unknown>;
}

export interface LlmGatewayResponse {
  output: Record<string, unknown>;
  provider: string;
  model: string;
}
