import type { TaskRepository } from "./index";
import type { AsyncTaskRecord } from "./persistence";

export class InMemoryTaskRepository implements TaskRepository {
  private tasks = new Map<string, AsyncTaskRecord>();

  async create(task: AsyncTaskRecord): Promise<void> {
    this.tasks.set(task.id, task);
  }

  async update(id: string, patch: Partial<AsyncTaskRecord>): Promise<void> {
    const current = this.tasks.get(id);
    if (!current) {
      return undefined;
    }
    this.tasks.set(id, { ...current, ...patch });
  }

  async findById(id: string): Promise<AsyncTaskRecord | null> {
    return this.tasks.get(id) ?? null;
  }
}

export const createInMemoryTaskRepository = (): TaskRepository =>
  new InMemoryTaskRepository();

export const createNoopTaskRepository = (): TaskRepository => ({
  async create() {
    return undefined;
  },
  async update() {
    return undefined;
  },
  async findById() {
    return null;
  }
});
