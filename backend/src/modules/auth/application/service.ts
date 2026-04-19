import { randomUUID } from "crypto";
import { AppError } from "../../../app/common/errors";
import { loadConfig } from "../../../app/config";
import type { UserProfileRepository } from "../../user-profile/infrastructure";
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

export interface PersistentAuthServiceDependencies {
  userProfileRepository: UserProfileRepository;
}

interface WechatCodeSessionResponse {
  openid?: string;
  unionid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

export class PersistentWechatAuthService implements AuthService {
  constructor(private readonly deps: PersistentAuthServiceDependencies) {}

  async wechatLogin(command: AuthLoginCommand): Promise<AuthLoginResult> {
    const session = await exchangeWechatCode(command.code);
    const now = new Date();
    const existingUser = await this.deps.userProfileRepository.findByWechatOpenId(session.openid);
    const legacyUser =
      !existingUser && command.legacyUserId
        ? await this.deps.userProfileRepository.findById(command.legacyUserId)
        : null;

    const targetUser = existingUser ?? legacyUser;
    const userId = targetUser?.id ?? generateId();
    const isNewUser = !targetUser;

    await this.deps.userProfileRepository.saveUser({
      id: userId,
      wechatOpenId: session.openid,
      unionId: session.unionid ?? targetUser?.unionId ?? null,
      nickname: targetUser?.nickname ?? `用户 ${userId.slice(0, 8)}`,
      avatarUrl: targetUser?.avatarUrl ?? null,
      status: "active",
      createdAt: targetUser?.createdAt ?? now,
      updatedAt: now
    });

    return {
      token: buildAccessToken(userId),
      refreshToken: buildRefreshToken(userId),
      userId,
      isNewUser
    };
  }

  async verifyToken(token: string): Promise<AuthTokenPayload> {
    return verifyStatelessToken(token, "access");
  }

  async refreshToken(refreshToken: string): Promise<AuthLoginResult> {
    const payload = verifyStatelessToken(refreshToken, "refresh");
    return {
      token: buildAccessToken(payload.userId),
      refreshToken: buildRefreshToken(payload.userId),
      userId: payload.userId,
      isNewUser: false
    };
  }
}

export function createPersistentWechatAuthService(
  deps: PersistentAuthServiceDependencies
): AuthService {
  return new PersistentWechatAuthService(deps);
}

function generateId(): string {
  try {
    return randomUUID();
  } catch (error) {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

async function exchangeWechatCode(code: string): Promise<Required<Pick<WechatCodeSessionResponse, "openid">> & WechatCodeSessionResponse> {
  const config = loadConfig();
  if (!config.wechat.appId || !config.wechat.appSecret) {
    throw new AppError(
      "WeChat login is not configured. Please set WECHAT_APP_ID and WECHAT_APP_SECRET.",
      "INVALID_REQUEST",
      500
    );
  }

  const params = new URLSearchParams({
    appid: config.wechat.appId,
    secret: config.wechat.appSecret,
    js_code: code,
    grant_type: "authorization_code"
  });

  let response: Response;
  try {
    response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${params.toString()}`);
  } catch (error) {
    throw new AppError("Failed to reach WeChat login service", "INVALID_REQUEST", 502);
  }

  if (!response.ok) {
    throw new AppError("WeChat login request failed", "INVALID_REQUEST", 502);
  }

  const payload = (await response.json()) as WechatCodeSessionResponse;
  if (payload.errcode || !payload.openid) {
    throw new AppError(
      payload.errmsg || "WeChat login failed",
      "INVALID_REQUEST",
      400
    );
  }

  return payload as Required<Pick<WechatCodeSessionResponse, "openid">> & WechatCodeSessionResponse;
}

function buildAccessToken(userId: string): string {
  return `access.${userId}`;
}

function buildRefreshToken(userId: string): string {
  return `refresh.${userId}`;
}

function verifyStatelessToken(
  token: string,
  expectedPrefix: "access" | "refresh"
): AuthTokenPayload {
  const [prefix, userId] = String(token || "").split(".");
  if (prefix !== expectedPrefix || !userId) {
    throw new AppError("Invalid token", "INVALID_TOKEN", 401);
  }

  return {
    userId,
    issuedAt: new Date(0).toISOString()
  };
}
