import { createObjectValidator, optionalNumber } from "../../../app/common";
import type { WeatherCurrentQueryDTO } from "./dtos";

export const validateWeatherCurrentQuery =
  createObjectValidator<WeatherCurrentQueryDTO>({
    force: optionalNumber({ integer: true, min: 0, max: 1 })
  });
