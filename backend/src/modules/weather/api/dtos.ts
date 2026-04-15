export interface WeatherCurrentQueryDTO {
  force?: number;
}

export interface WeatherCurrentResponseDTO {
  city: string;
  temperature: number;
  condition: string;
  fetchedAt: string;
  source: "cache" | "provider";
}
