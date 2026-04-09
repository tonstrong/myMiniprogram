import type { AsyncTaskRecord } from "./persistence";

export interface TaskRepository {
  create(task: AsyncTaskRecord): Promise<void>;
  update(id: string, patch: Partial<AsyncTaskRecord>): Promise<void>;
  findById(id: string): Promise<AsyncTaskRecord | null>;
}

export * from "./mappers";
export * from "./repository-adapters";
