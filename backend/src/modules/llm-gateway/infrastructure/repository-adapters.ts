import type {
  ModelInvocationLogRepository,
  ProviderConfigRepository
} from "./index";
import type {
  ModelInvocationLogRecord,
  ProviderConfigRecord
} from "./persistence";

export class InMemoryModelInvocationLogRepository
  implements ModelInvocationLogRepository
{
  private logs: ModelInvocationLogRecord[] = [];

  async save(record: ModelInvocationLogRecord): Promise<void> {
    this.logs.push(record);
  }
}

export class InMemoryProviderConfigRepository
  implements ProviderConfigRepository
{
  private configs: ProviderConfigRecord[];

  constructor(initialConfigs: ProviderConfigRecord[] = []) {
    this.configs = [...initialConfigs];
  }

  async findActiveByTaskType(
    taskType: string
  ): Promise<ProviderConfigRecord | null> {
    return (
      this.configs.find(
        (config) => config.taskType === taskType && config.status === "active"
      ) ?? null
    );
  }
}

export const createInMemoryModelInvocationLogRepository =
  (): ModelInvocationLogRepository => new InMemoryModelInvocationLogRepository();

export const createInMemoryProviderConfigRepository = (
  configs: ProviderConfigRecord[] = []
): ProviderConfigRepository => new InMemoryProviderConfigRepository(configs);

export const createNoopModelInvocationLogRepository =
  (): ModelInvocationLogRepository => ({
    async save() {
      return undefined;
    }
  });

export const createNoopProviderConfigRepository =
  (): ProviderConfigRepository => ({
    async findActiveByTaskType() {
      return null;
    }
  });
