import type { AppContext } from "../bootstrap/app";

export interface ModuleRegistration {
  name: string;
  init: (context: AppContext) => Promise<void> | void;
}

export interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
  requestId: string;
}

export interface PaginatedResult<T> {
  items: T[];
  pageNo: number;
  pageSize: number;
  total: number;
}

export interface PaginationQuery {
  pageNo?: number;
  pageSize?: number;
}

export type TaskStatus =
  | "uploaded"
  | "processing"
  | "needs_review"
  | "completed"
  | "failed"
  | "transcribing"
  | "extracting"
  | "needs_confirm"
  | "active";

export type TaskType =
  | "extract_clothing_attributes"
  | "extract_style_pack"
  | "generate_outfit_recommendations"
  | "content_safety_scan"
  | "file_cleanup"
  | "custom";

export interface ProviderMeta {
  provider: string;
  modelName?: string;
  modelTier?: string;
  retryCount?: number;
  fallbackUsed?: boolean;
  latencyMs?: number;
}

export interface TaskStatusSnapshot {
  taskId: string;
  taskType: TaskType;
  status: TaskStatus;
  progress?: number;
  resultSummary?: string;
  providerMeta?: ProviderMeta;
}
