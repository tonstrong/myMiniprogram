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
  status: TaskStatus;
  progress: number;
  resultSummary?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  finishedAt?: Date | null;
}
