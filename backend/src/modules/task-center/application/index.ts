import type { ProviderMeta, TaskStatus, TaskType } from "../../../app/common/types";
import type { JsonValue } from "../../../app/common/persistence";

export interface CreateTaskCommand {
  taskType: TaskType;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  requesterId?: string;
  bizType?: string;
  bizId?: string;
  availableAt?: Date;
  maxAttempts?: number;
}

export interface TaskStatusSnapshot {
  taskId: string;
  taskType: TaskType;
  status: TaskStatus;
  progress?: number;
  resultSummary?: string;
  providerMeta?: ProviderMeta;
  resultPayload?: JsonValue;
}

export interface UpdateTaskStatusCommand {
  taskId: string;
  status: TaskStatus;
  progress?: number;
  resultSummary?: string;
  providerMeta?: ProviderMeta;
  resultPayload?: JsonValue;
  errorCode?: string;
  errorMessage?: string;
  availableAt?: Date | null;
  lockedAt?: Date | null;
  lockedBy?: string | null;
  attemptCount?: number;
  maxAttempts?: number;
  finishedAt?: Date | null;
}

export interface TaskCenterService {
  createTask(command: CreateTaskCommand): Promise<TaskStatusSnapshot>;
  getTask(userId: string, taskId: string): Promise<TaskStatusSnapshot | null>;
  updateTask(command: UpdateTaskStatusCommand): Promise<TaskStatusSnapshot>;
}

export * from "./service";
