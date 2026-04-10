import type { IncomingMessage } from "http";
import { randomUUID } from "crypto";
import type { RequestContext } from "../../common";
import { AppError } from "../../common/errors";

const NUMERIC_QUERY_KEYS = new Set(["pageNo", "pageSize"]);

export interface ParsedRequestBody {
  body: unknown;
}

export function createRequestContext(request: IncomingMessage): RequestContext {
  return {
    requestId: generateRequestId(),
    userId: readHeaderValue(request, "x-user-id")
  };
}

export function parseQueryParams(url: URL): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  for (const [key, value] of url.searchParams.entries()) {
    const nextValue = coerceQueryValue(key, value);
    const existing = query[key];

    if (existing === undefined) {
      query[key] = nextValue;
      continue;
    }

    if (Array.isArray(existing)) {
      existing.push(nextValue);
      continue;
    }

    query[key] = [existing, nextValue];
  }

  return query;
}

export async function parseRequestBody(
  request: IncomingMessage
): Promise<ParsedRequestBody> {
  const rawBody = await readRawBody(request);
  if (!rawBody) {
    return { body: undefined };
  }

  const contentType = `${request.headers["content-type"] ?? ""}`.toLowerCase();
  if (contentType.includes("application/json") || contentType.includes("+json")) {
    try {
      return { body: JSON.parse(rawBody) };
    } catch (error) {
      throw new AppError("Invalid JSON body", "INVALID_JSON", 400);
    }
  }

  return { body: rawBody };
}

function readHeaderValue(
  request: IncomingMessage,
  headerName: string
): string | undefined {
  const value = request.headers[headerName.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function generateRequestId(): string {
  try {
    return randomUUID();
  } catch (error) {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function coerceQueryValue(key: string, value: string): unknown {
  if (NUMERIC_QUERY_KEYS.has(key)) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return value;
}

function readRawBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString("utf-8");
    });
    request.on("end", () => resolve(body));
    request.on("error", (error) => reject(error));
  });
}
