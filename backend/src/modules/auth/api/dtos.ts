export interface WechatLoginRequestDTO {
  code: string;
}

export interface AuthUserInfoDTO {
  userId: string;
  nickname?: string;
  avatarUrl?: string;
  isNewUser: boolean;
}

export interface LoginResponseDTO {
  token: string;
  userInfo: AuthUserInfoDTO;
}

export interface RefreshTokenRequestDTO {
  refreshToken: string;
}

export interface RefreshTokenResponseDTO {
  token: string;
  refreshToken?: string;
}
