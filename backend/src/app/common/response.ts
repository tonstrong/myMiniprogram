export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface BinaryResponse {
  kind: "binary";
  status: number;
  body: Buffer;
  headers?: Record<string, string>;
}

export type HttpResponse<T = unknown> = ApiResponse<T> | BinaryResponse;

export function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export function fail(code: string, message: string): ApiResponse<never> {
  return { success: false, error: { code, message } };
}

export function binary(
  body: Buffer,
  options: { status?: number; headers?: Record<string, string> } = {}
): BinaryResponse {
  return {
    kind: "binary",
    status: options.status ?? 200,
    headers: options.headers,
    body
  };
}
