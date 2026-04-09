import type { StylePackRepository } from "./index";
import type { StylePackRecord, StylePackRuleVersionRecord } from "./persistence";

export class InMemoryStylePackRepository implements StylePackRepository {
  private stylePacks = new Map<string, StylePackRecord>();
  private ruleVersions = new Map<string, StylePackRuleVersionRecord[]>();

  async saveStylePack(record: StylePackRecord): Promise<void> {
    this.stylePacks.set(record.id, record);
  }

  async updateStylePack(
    id: string,
    patch: Partial<StylePackRecord>
  ): Promise<void> {
    const current = this.stylePacks.get(id);
    if (!current) {
      return undefined;
    }
    this.stylePacks.set(id, { ...current, ...patch });
  }

  async appendRuleVersion(record: StylePackRuleVersionRecord): Promise<void> {
    const existing = this.ruleVersions.get(record.stylePackId) ?? [];
    this.ruleVersions.set(record.stylePackId, [...existing, record]);
  }

  async findById(id: string): Promise<StylePackRecord | null> {
    return this.stylePacks.get(id) ?? null;
  }
}

export const createInMemoryStylePackRepository = (): StylePackRepository =>
  new InMemoryStylePackRepository();

export const createNoopStylePackRepository = (): StylePackRepository => ({
  async saveStylePack() {
    return undefined;
  },
  async updateStylePack() {
    return undefined;
  },
  async appendRuleVersion() {
    return undefined;
  },
  async findById() {
    return null;
  }
});
