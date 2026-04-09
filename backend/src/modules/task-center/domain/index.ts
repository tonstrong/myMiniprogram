export type TaskStatus = "pending" | "running" | "succeeded" | "failed";

export interface TaskRecord {
  id: string;
  status: TaskStatus;
  relatedEntityId?: string;
}
