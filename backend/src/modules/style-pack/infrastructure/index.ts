export interface StylePackRepository {
  save(rule: unknown): Promise<void>;
}
