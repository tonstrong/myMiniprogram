export interface UserProfileSnapshot {
  userId: string;
  nickname?: string;
  avatarUrl?: string;
  stylePreferences: string[];
  bodyPreferences: string[];
  city?: string;
  defaultTemperatureSensitivity?: string;
}

export interface UpdateUserProfileCommand {
  userId: string;
  nickname?: string;
  avatarUrl?: string;
  stylePreferences?: string[];
  bodyPreferences?: string[];
  city?: string;
  defaultTemperatureSensitivity?: string;
}

export interface UserProfileService {
  getProfile(userId: string): Promise<UserProfileSnapshot>;
  updateProfile(command: UpdateUserProfileCommand): Promise<UserProfileSnapshot>;
}
