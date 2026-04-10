export interface AuthTokenPayload {
  userId: string;
  issuedAt: string;
  expiresAt?: string;
}

export interface AuthLoginCommand {
  code: string;
  requestId?: string;
}

export interface AuthLoginResult {
  token: string;
  refreshToken?: string;
  userId: string;
  isNewUser: boolean;
}

export interface AuthService {
  wechatLogin(command: AuthLoginCommand): Promise<AuthLoginResult>;
  verifyToken(token: string): Promise<AuthTokenPayload>;
  refreshToken(refreshToken: string): Promise<AuthLoginResult>;
}

export * from "./service";
