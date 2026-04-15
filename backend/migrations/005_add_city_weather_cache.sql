CREATE TABLE city_weather_cache (
  city_key VARCHAR(128) PRIMARY KEY,
  city_name VARCHAR(64) NOT NULL,
  temperature DECIMAL(5,2) NOT NULL,
  condition_text VARCHAR(64) NOT NULL,
  raw_json JSON NULL,
  fetched_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE INDEX idx_city_weather_cache_fetched_at ON city_weather_cache(fetched_at);
