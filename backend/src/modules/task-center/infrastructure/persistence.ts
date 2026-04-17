import type {
  BaseRecord,
  JsonValue,
  ProviderMetaJsonField
} from "../../../app/common/persistence";
import type { TaskStatus, TaskType } from "../../../app/common/types";

export interface AsyncTaskRecord extends BaseRecord, ProviderMetaJsonField {
  userId: string;
  taskType: TaskType;
  bizType: string;
  bizId?: string | null;
  payloadJson?: JsonValue | null;
  status: TaskStatus;
  progress: number;
  resultSummary?: string | null;
  resultJson?: JsonValue | null;
  idempotencyKey?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  finishedAt?: Date | null;
  availableAt?: Date | null;
  lockedAt?: Date | null;
  lockedBy?: string | null;
  attemptCount: number;
  maxAttempts: number;
}
