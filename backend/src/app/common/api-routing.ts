import type { RequestContext } from "./request-context";
import type { HttpResponse } from "./response";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface ApiRequest<TBody = any, TQuery = any, TParams = any> {
  context: RequestContext;
  body: TBody;
  query: TQuery;
  params: TParams;
}

export type ApiHandler<
  TBody = any,
  TQuery = any,
  TParams = any,
  TResult = any
> = (request: ApiRequest<TBody, TQuery, TParams>) => Promise<HttpResponse<TResult>>;

export interface ApiRouteDefinition<
  TBody = any,
  TQuery = any,
  TParams = any,
  TResult = any
> {
  method: HttpMethod;
  path: string;
  handler: ApiHandler<TBody, TQuery, TParams, TResult>;
  summary?: string;
}

export function parseRoute(route: string): { method: HttpMethod; path: string } {
  const [method, ...pathParts] = route.trim().split(" ");
  if (!method || pathParts.length === 0) {
    throw new Error(`Invalid route: ${route}`);
  }

  return { method: method as HttpMethod, path: pathParts.join(" ") };
}
