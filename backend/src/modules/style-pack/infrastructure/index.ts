import type {
  StylePackRecord,
  StylePackRuleVersionRecord
} from "./persistence";

export interface StylePackRepository {
  saveStylePack(record: StylePackRecord): Promise<void>;
  updateStylePack(id: string, patch: Partial<StylePackRecord>): Promise<void>;
  appendRuleVersion(record: StylePackRuleVersionRecord): Promise<void>;
  findById(id: string): Promise<StylePackRecord | null>;
  listStylePacksByUserId(userId: string): Promise<StylePackRecord[]>;
}

export * from "./mappers";
export * from "./repository-adapters";
