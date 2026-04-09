import {
  createObjectValidator,
  requiredString
} from "../../../app/common/validation";
import type {
  RefreshTokenRequestDTO,
  WechatLoginRequestDTO
} from "./dtos";

export const validateWechatLoginRequest =
  createObjectValidator<WechatLoginRequestDTO>({
    code: requiredString({ minLength: 1 })
  });

export const validateRefreshTokenRequest =
  createObjectValidator<RefreshTokenRequestDTO>({
    refreshToken: requiredString({ minLength: 1 })
  });
