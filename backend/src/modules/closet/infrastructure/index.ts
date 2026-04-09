export interface ClosetRepository {
  save(item: unknown): Promise<void>;
}
