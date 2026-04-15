import type { CreatedAtRecord, JsonValue } from "../../../app/common/persistence";

export interface CityWeatherCacheRecord extends CreatedAtRecord {
  cityKey: string;
  cityName: string;
  temperature: number;
  conditionText: string;
  rawJson?: JsonValue | null;
  fetchedAt: Date;
  updatedAt: Date;
}
