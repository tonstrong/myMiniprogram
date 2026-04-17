import type { AsyncTaskRecord } from "./persistence";
import type { TaskType } from "../../../app/common/types";

export interface TaskRepository {
  create(task: AsyncTaskRecord): Promise<void>;
  update(id: string, patch: Partial<AsyncTaskRecord>): Promise<void>;
  findById(id: string): Promise<AsyncTaskRecord | null>;
  findByIdForUser(id: string, userId: string): Promise<AsyncTaskRecord | null>;
  claimNextReadyTask(input: {
    workerId: string;
    taskTypes: TaskType[];
    leaseMs: number;
  }): Promise<AsyncTaskRecord | null>;
}

export * from "./mappers";
export * from "./repository-adapters";
