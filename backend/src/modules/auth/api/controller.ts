import {
  fail,
  formatValidationErrors,
  ok,
  parseRoute,
  validateRequest
} from "../../../app/common";
import type { ApiRequest, ApiRouteDefinition } from "../../../app/common";
import type { ApiResponse } from "../../../app/common/response";
import type { AuthService } from "../application";
import type {
  LoginResponseDTO,
  RefreshTokenRequestDTO,
  RefreshTokenResponseDTO,
  WechatLoginRequestDTO
} from "./dtos";
import { AuthRoutes } from "./index";
import {
  validateRefreshTokenRequest,
  validateWechatLoginRequest
} from "./validators";

export interface AuthControllerDependencies {
  authService: AuthService;
}

export class AuthController {
  constructor(private readonly deps: AuthControllerDependencies) {}

  async wechatLogin(
    request: ApiRequest<WechatLoginRequestDTO>
  ): Promise<ApiResponse<LoginResponseDTO>> {
    const validation = validateRequest(
      request.body,
      validateWechatLoginRequest
    );
    if (!validation.ok) {
      return fail("INVALID_REQUEST", formatValidationErrors(validation.errors));
    }

    const result = await this.deps.authService.wechatLogin({
      code: validation.value.code,
      requestId: request.context.requestId
    });

    return ok({
      token: result.token,
      userInfo: {
        userId: result.userId,
        isNewUser: result.isNewUser
      }
    });
  }

  async refreshToken(
    request: ApiRequest<RefreshTokenRequestDTO>
  ): Promise<ApiResponse<RefreshTokenResponseDTO>> {
    const validation = validateRequest(
      request.body,
      validateRefreshTokenRequest
    );
    if (!validation.ok) {
      return fail("INVALID_REQUEST", formatValidationErrors(validation.errors));
    }

    const result = await this.deps.authService.refreshToken(
      validation.value.refreshToken
    );

    return ok({
      token: result.token,
      refreshToken: result.refreshToken
    });
  }
}

export function createAuthControllerRoutes(
  controller: AuthController
): ApiRouteDefinition[] {
  return [
    {
      ...parseRoute(AuthRoutes.wechatLogin),
      summary: "WeChat login",
      handler: controller.wechatLogin.bind(controller)
    },
    {
      ...parseRoute(AuthRoutes.refresh),
      summary: "Refresh access token",
      handler: controller.refreshToken.bind(controller)
    }
  ];
}
