import { randomUUID } from "crypto";
import { AppError } from "../../../app/common/errors";
import type {
  AuthLoginCommand,
  AuthLoginResult,
  AuthService,
  AuthTokenPayload
} from "./index";

interface TokenRecord {
  token: string;
  payload: AuthTokenPayload;
}

export class InMemoryAuthService implements AuthService {
  private readonly codeToUserId = new Map<string, string>();
  private readonly tokenByUserId = new Map<string, TokenRecord>();
  private readonly tokenPayloads = new Map<string, AuthTokenPayload>();
  private readonly refreshTokenByUserId = new Map<string, string>();
  private readonly refreshTokenIndex = new Map<string, string>();

  async wechatLogin(command: AuthLoginCommand): Promise<AuthLoginResult> {
    const existingUserId = this.codeToUserId.get(command.code);
    const userId = existingUserId ?? generateId();
    const isNewUser = !existingUserId;

    if (!existingUserId) {
      this.codeToUserId.set(command.code, userId);
    }

    const token = this.issueToken(userId);
    const refreshToken = this.issueRefreshToken(userId);

    return {
      token,
      refreshToken,
      userId,
      isNewUser
    };
  }

  async verifyToken(token: string): Promise<AuthTokenPayload> {
    const payload = this.tokenPayloads.get(token);
    if (!payload) {
      throw new AppError("Invalid token", "INVALID_TOKEN", 401);
    }
    return payload;
  }

  async refreshToken(refreshToken: string): Promise<AuthLoginResult> {
    const userId = this.refreshTokenIndex.get(refreshToken);
    if (!userId) {
      throw new AppError("Invalid refresh token", "INVALID_TOKEN", 401);
    }

    const token = this.issueToken(userId);
    const nextRefreshToken = this.issueRefreshToken(userId);

    return {
      token,
      refreshToken: nextRefreshToken,
      userId,
      isNewUser: false
    };
  }

  private issueToken(userId: string): string {
    const existing = this.tokenByUserId.get(userId);
    if (existing) {
      return existing.token;
    }

    const token = `token-${userId}`;
    const payload: AuthTokenPayload = {
      userId,
      issuedAt: new Date().toISOString()
    };

    this.tokenByUserId.set(userId, { token, payload });
    this.tokenPayloads.set(token, payload);

    return token;
  }

  private issueRefreshToken(userId: string): string {
    const existing = this.refreshTokenByUserId.get(userId);
    if (existing) {
      return existing;
    }

    const refreshToken = `refresh-${userId}`;
    this.refreshTokenByUserId.set(userId, refreshToken);
    this.refreshTokenIndex.set(refreshToken, userId);
    return refreshToken;
  }
}

export function createInMemoryAuthService(): AuthService {
  return new InMemoryAuthService();
}

function generateId(): string {
  try {
    return randomUUID();
  } catch (error) {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
