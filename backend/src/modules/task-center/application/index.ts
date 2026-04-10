import type { ProviderMeta, TaskStatus, TaskType } from "../../../app/common/types";

export interface CreateTaskCommand {
  taskType: TaskType;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  requesterId?: string;
}

export interface TaskStatusSnapshot {
  taskId: string;
  taskType: TaskType;
  status: TaskStatus;
  progress?: number;
  resultSummary?: string;
  providerMeta?: ProviderMeta;
}

export interface UpdateTaskStatusCommand {
  taskId: string;
  status: TaskStatus;
  progress?: number;
  resultSummary?: string;
  providerMeta?: ProviderMeta;
}

export interface TaskCenterService {
  createTask(command: CreateTaskCommand): Promise<TaskStatusSnapshot>;
  getTask(taskId: string): Promise<TaskStatusSnapshot | null>;
  updateTask(command: UpdateTaskStatusCommand): Promise<TaskStatusSnapshot>;
}

export * from "./service";
