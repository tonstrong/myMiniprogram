import { AppError } from "../../../app/common/errors";
import { loadConfig } from "../../../app/config";
import type { UserProfileRepository } from "../../user-profile/infrastructure";
import type { CityWeatherCacheRecord, WeatherCacheRepository } from "../infrastructure";
import type { WeatherService, WeatherSnapshot } from "./index";

export class SharedWeatherService implements WeatherService {
  private inflight = new Map<string, Promise<WeatherSnapshot>>();

  constructor(
    private readonly deps: {
      repository: WeatherCacheRepository;
      userProfileRepository: UserProfileRepository;
    }
  ) {}

  async getCurrentWeatherForUser(
    userId: string,
    options?: { forceRefresh?: boolean }
  ): Promise<WeatherSnapshot> {
    const preferences = await this.deps.userProfileRepository.findPreferencesByUserId(userId);
    const city = preferences?.city?.trim();
    if (!city) {
      throw new AppError("请先在“我的”页面设置所在城市", "INVALID_REQUEST", 400);
    }

    const cityKey = normalizeCityKey(city);
    const cached = await this.deps.repository.findByCityKey(cityKey);
    const ttlMs = loadConfig().weather.ttlSeconds * 1000;
    const isFresh = cached && Date.now() - cached.fetchedAt.getTime() < ttlMs;

    if (cached && isFresh && !options?.forceRefresh) {
      return mapRecordToSnapshot(cached, "cache");
    }

    const existingInflight = this.inflight.get(cityKey);
    if (existingInflight) {
      return existingInflight;
    }

    const refreshPromise = this.refreshCityWeather(cityKey, city, cached);
    this.inflight.set(cityKey, refreshPromise);
    try {
      return await refreshPromise;
    } finally {
      this.inflight.delete(cityKey);
    }
  }

  private async refreshCityWeather(
    cityKey: string,
    cityName: string,
    fallback?: CityWeatherCacheRecord | null
  ): Promise<WeatherSnapshot> {
    try {
      const providerResult = await fetchQWeather(cityName);
      const now = new Date();
      const record: CityWeatherCacheRecord = {
        cityKey,
        cityName: providerResult.cityName,
        temperature: providerResult.temperature,
        conditionText: providerResult.condition,
        rawJson: providerResult.rawJson as import("../../../app/common/persistence").JsonValue,
        fetchedAt: now,
        createdAt: fallback?.createdAt ?? now,
        updatedAt: now
      };
      await this.deps.repository.save(record);
      return mapRecordToSnapshot(record, "provider");
    } catch (error) {
      if (fallback) {
        return mapRecordToSnapshot(fallback, "cache");
      }
      throw error;
    }
  }
}

export function createSharedWeatherService(deps: {
  repository: WeatherCacheRepository;
  userProfileRepository: UserProfileRepository;
}): WeatherService {
  return new SharedWeatherService(deps);
}

async function fetchQWeather(cityName: string): Promise<{
  cityName: string;
  temperature: number;
  condition: string;
  rawJson: Record<string, unknown>;
}> {
  const config = loadConfig().weather;
  if (config.provider !== "qweather" || !config.apiKey) {
    throw new AppError("天气服务尚未配置", "NOT_IMPLEMENTED", 501);
  }

  const lookupUrl = new URL("https://geoapi.qweather.com/v2/city/lookup");
  lookupUrl.searchParams.set("location", cityName);
  lookupUrl.searchParams.set("range", "cn");
  lookupUrl.searchParams.set("number", "1");
  lookupUrl.searchParams.set("key", config.apiKey);

  const lookupRes = await fetch(lookupUrl.toString());
  if (!lookupRes.ok) {
    throw new AppError("天气城市查询失败", "UPSTREAM_ERROR", 502);
  }
  const lookupJson = (await lookupRes.json()) as { location?: Array<{ id: string; name: string }> };
  const location = lookupJson.location?.[0];
  if (!location?.id) {
    throw new AppError("未找到对应城市天气数据", "NOT_FOUND", 404);
  }

  const weatherUrl = new URL("https://devapi.qweather.com/v7/weather/now");
  weatherUrl.searchParams.set("location", location.id);
  weatherUrl.searchParams.set("key", config.apiKey);

  const weatherRes = await fetch(weatherUrl.toString());
  if (!weatherRes.ok) {
    throw new AppError("天气服务调用失败", "UPSTREAM_ERROR", 502);
  }
  const weatherJson = (await weatherRes.json()) as {
    now?: { temp?: string; text?: string };
  };

  const temperature = Number(weatherJson.now?.temp ?? NaN);
  const condition = weatherJson.now?.text?.trim();
  if (Number.isNaN(temperature) || !condition) {
    throw new AppError("天气数据格式异常", "UPSTREAM_ERROR", 502);
  }

  return {
    cityName: location.name,
    temperature,
    condition,
    rawJson: weatherJson as Record<string, unknown>
  };
}

function mapRecordToSnapshot(
  record: CityWeatherCacheRecord,
  source: "cache" | "provider"
): WeatherSnapshot {
  return {
    city: record.cityName,
    temperature: record.temperature,
    condition: record.conditionText,
    fetchedAt: record.fetchedAt.toISOString(),
    source
  };
}

function normalizeCityKey(city: string): string {
  return city.trim().toLowerCase();
}
