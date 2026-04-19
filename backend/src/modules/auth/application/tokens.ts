import { createHmac, timingSafeEqual } from "crypto";
import { AppError } from "../../../app/common/errors";
import { loadConfig } from "../../../app/config";
import type { AuthTokenPayload } from "./index";

type TokenType = "access" | "refresh";

interface SignedTokenPayload extends AuthTokenPayload {
  type: TokenType;
}

export function buildAccessToken(userId: string): string {
  return buildSignedToken(userId, "access");
}

export function buildRefreshToken(userId: string): string {
  return buildSignedToken(userId, "refresh");
}

export function verifyStatelessToken(
  token: string,
  expectedType: TokenType
): AuthTokenPayload {
  const [prefix, encodedPayload, signature] = String(token || "").split(".");
  if (prefix !== expectedType || !encodedPayload || !signature) {
    throw new AppError("Invalid token", "INVALID_TOKEN", 401);
  }

  const expectedSignature = sign(`${prefix}.${encodedPayload}`);
  if (!safeEqual(signature, expectedSignature)) {
    throw new AppError("Invalid token", "INVALID_TOKEN", 401);
  }

  let payload: SignedTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf-8"));
  } catch {
    throw new AppError("Invalid token", "INVALID_TOKEN", 401);
  }

  if (payload.type !== expectedType || !payload.userId) {
    throw new AppError("Invalid token", "INVALID_TOKEN", 401);
  }

  return {
    userId: payload.userId,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt
  };
}

function buildSignedToken(userId: string, type: TokenType): string {
  const payload: SignedTokenPayload = {
    type,
    userId,
    issuedAt: new Date().toISOString()
  };
  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(payload), "utf-8"));
  const unsigned = `${type}.${encodedPayload}`;
  return `${unsigned}.${sign(unsigned)}`;
}

function sign(value: string): string {
  return base64UrlEncode(
    createHmac("sha256", loadConfig().auth.tokenSecret)
      .update(value)
      .digest()
  );
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.byteLength === rightBuffer.byteLength &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function base64UrlEncode(value: Buffer): string {
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}
