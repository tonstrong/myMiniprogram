import type { UserProfileRepository } from "../../user-profile/infrastructure";
import type { WeatherCacheRepository } from "../infrastructure";

export interface WeatherSnapshot {
  city: string;
  temperature: number;
  condition: string;
  fetchedAt: string;
  source: "cache" | "provider";
}

export interface WeatherService {
  getCurrentWeatherForUser(
    userId: string,
    options?: { forceRefresh?: boolean }
  ): Promise<WeatherSnapshot>;
}

export interface WeatherServiceDependencies {
  repository: WeatherCacheRepository;
  userProfileRepository: UserProfileRepository;
}

export * from "./service";
