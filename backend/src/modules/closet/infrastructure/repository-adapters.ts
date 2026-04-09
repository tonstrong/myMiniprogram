import type { ClosetRepository } from "./index";
import type {
  ClothingItemAttributeHistoryRecord,
  ClothingItemRecord
} from "./persistence";

export class InMemoryClosetRepository implements ClosetRepository {
  private items = new Map<string, ClothingItemRecord>();
  private attributeHistory: ClothingItemAttributeHistoryRecord[] = [];

  async saveItem(item: ClothingItemRecord): Promise<void> {
    this.items.set(item.id, item);
  }

  async updateItem(
    id: string,
    patch: Partial<ClothingItemRecord>
  ): Promise<void> {
    const current = this.items.get(id);
    if (!current) {
      return undefined;
    }
    this.items.set(id, { ...current, ...patch });
  }

  async findItemById(id: string): Promise<ClothingItemRecord | null> {
    return this.items.get(id) ?? null;
  }

  async appendAttributeHistory(
    entry: ClothingItemAttributeHistoryRecord
  ): Promise<void> {
    this.attributeHistory.push(entry);
  }
}

export const createInMemoryClosetRepository = (): ClosetRepository =>
  new InMemoryClosetRepository();

export const createNoopClosetRepository = (): ClosetRepository => ({
  async saveItem() {
    return undefined;
  },
  async updateItem() {
    return undefined;
  },
  async findItemById() {
    return null;
  },
  async appendAttributeHistory() {
    return undefined;
  }
});
