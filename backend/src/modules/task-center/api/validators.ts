import {
  createObjectValidator,
  optionalString,
  requiredRecord,
  requiredString,
  requiredStringEnum
} from "../../../app/common/validation";
import type { TaskType } from "../../../app/common/types";
import type { CreateTaskRequestDTO } from "./dtos";
import type { TaskIdParams } from "./controller";

const taskTypeValues: TaskType[] = [
  "extract_clothing_attributes",
  "extract_style_pack",
  "generate_outfit_recommendations",
  "content_safety_scan",
  "file_cleanup",
  "custom"
];

export const validateCreateTaskRequest =
  createObjectValidator<CreateTaskRequestDTO>({
    taskType: requiredStringEnum(taskTypeValues),
    payload: requiredRecord(),
    idempotencyKey: optionalString({ minLength: 1 })
  });

export const validateTaskIdParams = createObjectValidator<TaskIdParams>({
  taskId: requiredString({ minLength: 1 })
});
