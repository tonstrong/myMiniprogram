import type { ApiRouteDefinition } from "../../common";

export interface RouteMatch {
  route: ApiRouteDefinition;
  params: Record<string, string>;
}

export function matchRoute(
  routes: ApiRouteDefinition[],
  method: string,
  path: string
): RouteMatch | null {
  const normalized = normalizePath(path);
  const requestSegments = splitPath(normalized);
  const upperMethod = method.toUpperCase();

  for (const route of routes) {
    if (route.method !== upperMethod) {
      continue;
    }

    const routeSegments = splitPath(normalizePath(route.path));
    if (routeSegments.length !== requestSegments.length) {
      continue;
    }

    const params: Record<string, string> = {};
    let matched = true;
    for (let index = 0; index < routeSegments.length; index += 1) {
      const routeSegment = routeSegments[index];
      const requestSegment = requestSegments[index];
      if (!routeSegment) {
        matched = false;
        break;
      }

      if (routeSegment.startsWith(":")) {
        const paramName = routeSegment.slice(1);
        params[paramName] = decodeURIComponent(requestSegment ?? "");
        continue;
      }

      if (routeSegment !== requestSegment) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return { route, params };
    }
  }

  return null;
}

function normalizePath(path: string): string {
  const withPrefix = path.startsWith("/") ? path : `/${path}`;
  if (withPrefix.length > 1 && withPrefix.endsWith("/")) {
    return withPrefix.slice(0, -1);
  }
  return withPrefix;
}

function splitPath(path: string): string[] {
  if (path === "/") {
    return [];
  }
  return path.split("/").filter(Boolean);
}
