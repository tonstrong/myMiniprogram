import type { ProviderMeta, TaskStatus, TaskType } from "../../../app/common/types";

export interface CreateTaskRequestDTO {
  taskType: TaskType;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface TaskStatusResponseDTO {
  taskId: string;
  taskType: TaskType;
  status: TaskStatus;
  progress?: number;
  resultSummary?: string;
  providerMeta?: ProviderMeta;
}
