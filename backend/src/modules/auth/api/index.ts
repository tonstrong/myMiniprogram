export * from "./dtos";
export * from "./controller";
export * from "./validators";

export const AuthRoutes = {
  wechatLogin: "POST /api/auth/wechat-login",
  refresh: "POST /api/auth/refresh"
};
