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

export interface UpdateUserAvatarCommand {
  userId: string;
  imageBase64: string;
  contentType?: string;
  filename?: string;
}

export interface UserAvatarImage {
  bytes: Buffer;
  contentType: string;
}

export interface UserProfileService {
  getProfile(userId: string): Promise<UserProfileSnapshot>;
  updateProfile(command: UpdateUserProfileCommand): Promise<UserProfileSnapshot>;
  updateAvatar(command: UpdateUserAvatarCommand): Promise<UserProfileSnapshot>;
  getAvatarImage(userId: string, accessKey: string): Promise<UserAvatarImage>;
}

export * from "./service";
