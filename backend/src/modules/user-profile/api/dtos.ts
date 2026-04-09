export interface UserProfileResponseDTO {
  userId: string;
  nickname?: string;
  avatarUrl?: string;
  stylePreferences: string[];
  bodyPreferences: string[];
  city?: string;
  defaultTemperatureSensitivity?: "low" | "normal" | "high";
}

export interface UpdateUserProfileRequestDTO {
  nickname?: string;
  avatarUrl?: string;
  stylePreferences?: string[];
  bodyPreferences?: string[];
  city?: string;
  defaultTemperatureSensitivity?: "low" | "normal" | "high";
}
