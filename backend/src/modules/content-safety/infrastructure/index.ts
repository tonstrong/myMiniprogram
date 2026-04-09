export interface ContentSafetyProvider {
  scan: (payload: unknown) => Promise<{ passed: boolean; reason?: string }>;
}
