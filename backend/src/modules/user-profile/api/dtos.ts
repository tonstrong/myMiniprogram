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

export interface UpdateUserAvatarRequestDTO {
  imageBase64: string;
  contentType?: string;
  filename?: string;
}

export interface GetUserAvatarQueryDTO {
  userId: string;
  key: string;
}
