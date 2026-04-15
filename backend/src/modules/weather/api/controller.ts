import {
  fail,
  formatValidationErrors,
  ok,
  parseRoute,
  validateRequest
} from "../../../app/common";
import type { ApiRequest, ApiRouteDefinition } from "../../../app/common";
import type { ApiResponse } from "../../../app/common/response";
import type { WeatherService } from "../application";
import type { WeatherCurrentQueryDTO, WeatherCurrentResponseDTO } from "./dtos";
import { WeatherRoutes } from "./index";
import { validateWeatherCurrentQuery } from "./validators";

export interface WeatherControllerDependencies {
  weatherService: WeatherService;
}

export class WeatherController {
  constructor(private readonly deps: WeatherControllerDependencies) {}

  async current(
    request: ApiRequest<unknown, WeatherCurrentQueryDTO>
  ): Promise<ApiResponse<WeatherCurrentResponseDTO>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const validation = validateRequest(request.query, validateWeatherCurrentQuery);
    if (!validation.ok) {
      return fail("INVALID_REQUEST", formatValidationErrors(validation.errors));
    }

    const result = await this.deps.weatherService.getCurrentWeatherForUser(userId, {
      forceRefresh: validation.value.force === 1
    });

    return ok(result);
  }
}

export function createWeatherControllerRoutes(
  controller: WeatherController
): ApiRouteDefinition[] {
  return [
    {
      ...parseRoute(WeatherRoutes.current),
      summary: "Get current weather by saved city",
      handler: controller.current.bind(controller)
    }
  ];
}
