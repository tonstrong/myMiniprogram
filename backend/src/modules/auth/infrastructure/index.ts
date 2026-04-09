export interface AuthTokenStore {
  verify(token: string): Promise<boolean>;
}
