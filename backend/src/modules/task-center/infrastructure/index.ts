export interface TaskRepository {
  save(task: unknown): Promise<void>;
}
