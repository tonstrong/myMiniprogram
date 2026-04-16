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
  ) { }

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

  const lookupRes = await fetch(lookupUrl.toString(), {
    headers: {
      "X-QW-Api-Key": config.apiKey
    }
  });
  const lookupText = await lookupRes.text();
  if (!lookupRes.ok) {
    console.error("和风天气城市查询失败", {
      url: lookupUrl.toString(),
      cityName,
      status: lookupRes.status,
      statusText: lookupRes.statusText,
      headers: Object.fromEntries(lookupRes.headers.entries()),
      body: lookupText
    });

    throw new AppError("天气城市查询失败", "UPSTREAM_ERROR", 502);
  }

  let lookupData;
  try {
    lookupData = JSON.parse(lookupText);
  } catch (e) {
    console.error("和风天气城市查询返回非 JSON", {
      url: lookupUrl.toString(),
      cityName,
      status: lookupRes.status,
      headers: Object.fromEntries(lookupRes.headers.entries()),
      body: lookupText
    });

    throw new AppError("天气城市查询返回格式异常", "UPSTREAM_ERROR", 502);
  }

  const lookupJson = lookupData as {
    code?: string;
    location?: Array<{
      id?: string;
      name?: string;
      adm1?: string;
      adm2?: string;
      country?: string;
      type?: string;
      rank?: string;
    }>;
  };
  if (lookupJson.code !== "200") {
    throw new AppError("澶╂皵鍩庡競鏌ヨ澶辫触", "UPSTREAM_ERROR", 502);
  }
  const location = pickBestQWeatherLocation(cityName, lookupJson.location);
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
    code?: string;
    now?: { temp?: string; text?: string };
  };
  if (weatherJson.code && weatherJson.code !== "200") {
    throw new AppError("澶╂皵鏈嶅姟璋冪敤澶辫触", "UPSTREAM_ERROR", 502);
  }

  const temperature = Number(weatherJson.now?.temp ?? NaN);
  const condition = weatherJson.now?.text?.trim();
  if (Number.isNaN(temperature) || !condition) {
    throw new AppError("天气数据格式异常", "UPSTREAM_ERROR", 502);
  }

  return {
    cityName: location.name ?? cityName,
    temperature,
    condition,
    rawJson: {
      lookup: lookupJson as Record<string, unknown>,
      weather: weatherJson as Record<string, unknown>
    }
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

function pickBestQWeatherLocation(
  cityName: string,
  locations?: Array<{
    id?: string;
    name?: string;
    adm1?: string;
    adm2?: string;
    country?: string;
    type?: string;
    rank?: string;
  }>
) {
  if (!locations?.length) {
    return undefined;
  }

  const target = normalizeAdministrativeName(cityName);
  const scored = locations
    .filter((location) => location.id && location.name)
    .map((location) => ({
      location,
      score: scoreQWeatherLocation(target, location)
    }))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.location;
}

function scoreQWeatherLocation(
  target: string,
  location: {
    name?: string;
    adm1?: string;
    adm2?: string;
    country?: string;
    type?: string;
    rank?: string;
  }
): number {
  const normalizedName = normalizeAdministrativeName(location.name);
  const normalizedAdm1 = normalizeAdministrativeName(location.adm1);
  const normalizedAdm2 = normalizeAdministrativeName(location.adm2);
  const normalizedCountry = normalizeAdministrativeName(location.country);
  let score = 0;

  if (normalizedCountry === "中国") {
    score += 5;
  }
  if (location.type === "city") {
    score += 20;
  }
  if (normalizedName === target) {
    score += 60;
  }
  if (normalizedAdm2 === target) {
    score += 30;
  }
  if (normalizedAdm1 === target) {
    score += 15;
  }
  if (normalizedName === normalizedAdm2) {
    score += 40;
  }
  if (normalizedName && normalizedAdm2 && normalizedName !== normalizedAdm2) {
    score -= 25;
  }
  if (location.rank) {
    const rank = Number(location.rank);
    if (!Number.isNaN(rank)) {
      score -= rank;
    }
  }

  return score;
}

function normalizeAdministrativeName(value?: string): string {
  if (!value) {
    return "";
  }

  return value
    .trim()
    .replace(/^(中国|中华人民共和国)/, "")
    .replace(/(特别行政区|自治区|自治州|地区|盟|省|市|区|县|旗)$/g, "")
    .trim()
    .toLowerCase();
}
