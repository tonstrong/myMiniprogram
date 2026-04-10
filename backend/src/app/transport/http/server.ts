import http from "http";
import type { IncomingMessage, ServerResponse } from "http";
import type { AppContext } from "../../bootstrap/app";
import type { ApiRouteDefinition } from "../../common";
import { fail } from "../../common";
import { AppError } from "../../common/errors";
import { createRequestContext, parseQueryParams, parseRequestBody } from "./request";
import { matchRoute } from "./router";

export interface HttpServerOptions {
  context: AppContext;
  routes: ApiRouteDefinition[];
}

export function createHttpServer(options: HttpServerOptions): http.Server {
  const { context, routes } = options;

  return http.createServer(async (request, response) => {
    try {
      await handleRequest(request, response, options);
    } catch (error) {
      const requestId = response.getHeader("x-request-id")?.toString();
      context.logger.error("HTTP request failed", {
        requestId,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      respondWithError(response, error);
    }
  });
}

export function startHttpServer(options: HttpServerOptions): Promise<http.Server> {
  const { context } = options;
  const server = createHttpServer(options);

  return new Promise((resolve) => {
    server.listen(context.config.port, () => {
      context.logger.info(`HTTP server listening on port ${context.config.port}`);
      resolve(server);
    });
  });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: HttpServerOptions
): Promise<void> {
  const { context, routes } = options;
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  const requestContext = createRequestContext(request);
  response.setHeader("x-request-id", requestContext.requestId);
  const match = matchRoute(routes, method, url.pathname);

  if (!match) {
    respondJson(response, 404, fail("NOT_FOUND", "Route not found"));
    return;
  }

  const query = parseQueryParams(url);
  const { body } = await parseRequestBody(request);

  const result = await match.route.handler({
    context: requestContext,
    body,
    query,
    params: match.params
  });

  const status = result.success ? 200 : mapErrorStatus(result.error?.code);
  respondJson(response, status, result);
}

function respondWithError(response: ServerResponse, error: unknown): void {
  if (error instanceof AppError) {
    respondJson(response, error.status, fail(error.code, error.message));
    return;
  }

  const message = error instanceof Error ? error.message : "Unexpected error";
  respondJson(response, 500, fail("INTERNAL_ERROR", message));
}

function mapErrorStatus(code?: string): number {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "INVALID_REQUEST":
    case "INVALID_JSON":
      return 400;
    case "TASK_NOT_FOUND":
    case "NOT_FOUND":
      return 404;
    case "NOT_IMPLEMENTED":
      return 501;
    default:
      return 400;
  }
}

function respondJson(response: ServerResponse, status: number, payload: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}
