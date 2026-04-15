import type { CityWeatherCacheRecord } from "./persistence";

export interface WeatherCacheRepository {
  findByCityKey(cityKey: string): Promise<CityWeatherCacheRecord | null>;
  save(record: CityWeatherCacheRecord): Promise<void>;
}

export * from "./persistence";
export * from "./repository-adapters";
