import type {
  PaginatedResult,
  PaginationQuery,
  ProviderMeta
} from "../../../app/common/types";

export type StylePackSourceType = "text" | "video";

export type StylePackStatus =
  | "draft"
  | "needs_confirm"
  | "active"
  | "inactive"
  | "processing"
  | "failed";

export interface StylePackRules {
  summaryText?: string;
  rulesJson?: Record<string, unknown>;
  promptProfile?: Record<string, unknown>;
}

export interface StylePackSummary {
  stylePackId: string;
  name: string;
  sourceType: StylePackSourceType;
  status: StylePackStatus;
  version?: number;
  updatedAt?: string;
}

export interface StylePackDetail extends StylePackSummary {
  summaryText?: string;
  rulesJson?: Record<string, unknown>;
  promptProfile?: Record<string, unknown>;
  providerMeta?: ProviderMeta;
  transcriptText?: string;
}

export interface ImportStylePackTextCommand {
  userId: string;
  title: string;
  text: string;
  authConfirmed: boolean;
}

export interface ImportStylePackVideoCommand {
  userId: string;
  title: string;
  fileId?: string;
  authConfirmed: boolean;
}

export interface UpdateStylePackCommand {
  userId: string;
  stylePackId: string;
  name?: string;
  summaryText?: string;
  rulesJson?: Record<string, unknown>;
  promptProfile?: Record<string, unknown>;
}

export interface StylePackQuery extends PaginationQuery {
  status?: StylePackStatus;
  sourceType?: StylePackSourceType;
}

export interface StylePackService {
  importText(command: ImportStylePackTextCommand): Promise<StylePackDetail>;
  importVideo(command: ImportStylePackVideoCommand): Promise<StylePackDetail>;
  list(userId: string, query: StylePackQuery): Promise<PaginatedResult<StylePackSummary>>;
  getDetail(userId: string, stylePackId: string): Promise<StylePackDetail>;
  update(command: UpdateStylePackCommand): Promise<StylePackDetail>;
  activate(userId: string, stylePackId: string): Promise<StylePackDetail>;
  deactivate(userId: string, stylePackId: string): Promise<StylePackDetail>;
}

export * from "./service";
