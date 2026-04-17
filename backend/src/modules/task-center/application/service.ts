import { randomUUID } from "crypto";
import { AppError } from "../../../app/common/errors";
import type { JsonValue } from "../../../app/common/persistence";
import type {
  CreateTaskCommand,
  TaskCenterService,
  TaskStatusSnapshot,
  UpdateTaskStatusCommand
} from "./index";
import type { TaskRepository } from "../infrastructure";
import {
  createInMemoryTaskRepository,
  mapAsyncTaskRecordToSnapshot,
  mapUpdateTaskCommandToRecordPatch
} from "../infrastructure";
import type { AsyncTaskRecord } from "../infrastructure/persistence";

export interface TaskCenterServiceDependencies {
  repository: TaskRepository;
}

export class InMemoryTaskCenterService implements TaskCenterService {
  constructor(private readonly deps: TaskCenterServiceDependencies) {}

  async createTask(command: CreateTaskCommand): Promise<TaskStatusSnapshot> {
    const now = new Date();
    const record: AsyncTaskRecord = {
      id: generateId(),
      userId: command.requesterId ?? "anonymous",
      taskType: command.taskType,
      bizType: command.bizType ?? command.taskType,
      bizId: command.bizId ?? undefined,
      payloadJson: command.payload as unknown as JsonValue,
      status: "uploaded",
      progress: 0,
      resultSummary: undefined,
      resultJson: undefined,
      idempotencyKey: command.idempotencyKey,
      errorCode: undefined,
      errorMessage: undefined,
      finishedAt: undefined,
      providerMeta: undefined,
      availableAt: command.availableAt ?? now,
      lockedAt: undefined,
      lockedBy: undefined,
      attemptCount: 0,
      maxAttempts: command.maxAttempts ?? 3,
      createdAt: now,
      updatedAt: now
    };

    await this.deps.repository.create(record);
    return mapAsyncTaskRecordToSnapshot(record);
  }

  async getTask(userId: string, taskId: string): Promise<TaskStatusSnapshot | null> {
    const record = await this.deps.repository.findByIdForUser(taskId, userId);
    if (!record) {
      return null;
    }
    return mapAsyncTaskRecordToSnapshot(record);
  }

  async updateTask(command: UpdateTaskStatusCommand): Promise<TaskStatusSnapshot> {
    const patch = mapUpdateTaskCommandToRecordPatch(command);
    const now = new Date();
    const shouldFinish = command.status === "completed" || command.status === "failed";

    await this.deps.repository.update(command.taskId, {
      ...patch,
      updatedAt: now,
      finishedAt: command.finishedAt ?? (shouldFinish ? now : undefined)
    });

    const record = await this.deps.repository.findById(command.taskId);
    if (!record) {
      throw new AppError("Task not found", "TASK_NOT_FOUND", 404);
    }
    return mapAsyncTaskRecordToSnapshot(record);
  }
}

export function createTaskCenterService(
  deps: TaskCenterServiceDependencies
): TaskCenterService {
  return new InMemoryTaskCenterService(deps);
}

export function createInMemoryTaskCenterService(): TaskCenterService {
  return new InMemoryTaskCenterService({
    repository: createInMemoryTaskRepository()
  });
}

function generateId(): string {
  try {
    return randomUUID();
  } catch (error) {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
