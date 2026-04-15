import type { RowDataPacket } from "mysql2/promise";
import type { JsonValue } from "../../../app/common/persistence";
import { withClient } from "../../../app/db";
import type { WeatherCacheRepository } from "./index";
import type { CityWeatherCacheRecord } from "./persistence";

export class InMemoryWeatherCacheRepository implements WeatherCacheRepository {
  private records = new Map<string, CityWeatherCacheRecord>();

  async findByCityKey(cityKey: string): Promise<CityWeatherCacheRecord | null> {
    return this.records.get(cityKey) ?? null;
  }

  async save(record: CityWeatherCacheRecord): Promise<void> {
    this.records.set(record.cityKey, record);
  }
}

export const createInMemoryWeatherCacheRepository = (): WeatherCacheRepository =>
  new InMemoryWeatherCacheRepository();

interface CityWeatherCacheRow extends RowDataPacket {
  city_key: string;
  city_name: string;
  temperature: number;
  condition_text: string;
  raw_json: string | JsonValue | null;
  fetched_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

export class MySqlWeatherCacheRepository implements WeatherCacheRepository {
  async findByCityKey(cityKey: string): Promise<CityWeatherCacheRecord | null> {
    return withClient(async (client) => {
      const [rows] = await client.query<CityWeatherCacheRow[]>(
        `SELECT city_key, city_name, temperature, condition_text, raw_json, fetched_at, created_at, updated_at
         FROM city_weather_cache
         WHERE city_key = ?
         LIMIT 1`,
        [cityKey]
      );

      const row = rows[0];
      if (!row) {
        return null;
      }

      return {
        cityKey: row.city_key,
        cityName: row.city_name,
        temperature: Number(row.temperature),
        conditionText: row.condition_text,
        rawJson: decodeJson(row.raw_json),
        fetchedAt: toDate(row.fetched_at),
        createdAt: toDate(row.created_at),
        updatedAt: toDate(row.updated_at)
      };
    });
  }

  async save(record: CityWeatherCacheRecord): Promise<void> {
    await withClient(async (client) => {
      await client.query(
        `INSERT INTO city_weather_cache (
          city_key,
          city_name,
          temperature,
          condition_text,
          raw_json,
          fetched_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          city_name = VALUES(city_name),
          temperature = VALUES(temperature),
          condition_text = VALUES(condition_text),
          raw_json = VALUES(raw_json),
          fetched_at = VALUES(fetched_at),
          updated_at = VALUES(updated_at)`,
        [
          record.cityKey,
          record.cityName,
          record.temperature,
          record.conditionText,
          encodeJson(record.rawJson),
          formatDateTime(record.fetchedAt),
          formatDateTime(record.createdAt),
          formatDateTime(record.updatedAt)
        ]
      );
    });
  }
}

export const createMySqlWeatherCacheRepository = (): WeatherCacheRepository =>
  new MySqlWeatherCacheRepository();

function encodeJson(value?: JsonValue | null): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return JSON.stringify(value);
}

function decodeJson(value: unknown): JsonValue | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string") {
    return JSON.parse(value) as JsonValue;
  }
  return value as JsonValue;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function formatDateTime(value: Date): string {
  return value.toISOString().slice(0, 19).replace("T", " ");
}
