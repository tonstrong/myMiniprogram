import {
  fail,
  formatValidationErrors,
  ok,
  parseRoute,
  validateRequest
} from "../../../app/common";
import type { ApiRequest, ApiRouteDefinition } from "../../../app/common";
import type { ApiResponse } from "../../../app/common/response";
import type { TaskCenterService } from "../application";
import type { CreateTaskRequestDTO, TaskStatusResponseDTO } from "./dtos";
import { TaskCenterRoutes } from "./index";
import { validateCreateTaskRequest, validateTaskIdParams } from "./validators";

export interface TaskCenterControllerDependencies {
  taskCenterService: TaskCenterService;
}

export interface TaskIdParams {
  taskId: string;
}

export class TaskCenterController {
  constructor(private readonly deps: TaskCenterControllerDependencies) {}

  async createTask(
    request: ApiRequest<CreateTaskRequestDTO>
  ): Promise<ApiResponse<TaskStatusResponseDTO>> {
    const validation = validateRequest(
      request.body,
      validateCreateTaskRequest
    );
    if (!validation.ok) {
      return fail("INVALID_REQUEST", formatValidationErrors(validation.errors));
    }

    const result = await this.deps.taskCenterService.createTask({
      taskType: validation.value.taskType,
      payload: validation.value.payload,
      idempotencyKey: validation.value.idempotencyKey,
      requesterId: request.context.userId
    });

    return ok({
      taskId: result.taskId,
      taskType: result.taskType,
      status: result.status,
      progress: result.progress,
      resultSummary: result.resultSummary,
      providerMeta: result.providerMeta
    });
  }

  async getTask(
    request: ApiRequest<unknown, unknown, TaskIdParams>
  ): Promise<ApiResponse<TaskStatusResponseDTO>> {
    const userId = request.context.userId;
    if (!userId) {
      return fail("UNAUTHORIZED", "Missing user id");
    }

    const paramValidation = validateRequest(request.params, validateTaskIdParams);
    if (!paramValidation.ok) {
      return fail(
        "INVALID_REQUEST",
        formatValidationErrors(paramValidation.errors)
      );
    }

    const snapshot = await this.deps.taskCenterService.getTask(
      userId,
      paramValidation.value.taskId
    );

    if (!snapshot) {
      return fail("TASK_NOT_FOUND", "Task not found");
    }

    return ok({
      taskId: snapshot.taskId,
      taskType: snapshot.taskType,
      status: snapshot.status,
      progress: snapshot.progress,
      resultSummary: snapshot.resultSummary,
      providerMeta: snapshot.providerMeta
    });
  }
}

export function createTaskCenterControllerRoutes(
  controller: TaskCenterController
): ApiRouteDefinition[] {
  return [
    {
      ...parseRoute(TaskCenterRoutes.createTask),
      summary: "Create task",
      handler: controller.createTask.bind(controller)
    },
    {
      ...parseRoute(TaskCenterRoutes.getTask),
      summary: "Get task status",
      handler: controller.getTask.bind(controller)
    }
  ];
}
