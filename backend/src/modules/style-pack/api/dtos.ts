import type { ProviderMeta } from "../../../app/common/types";

export type StylePackSourceTypeDTO = "text" | "video";

export type StylePackStatusDTO =
  | "draft"
  | "needs_confirm"
  | "active"
  | "inactive"
  | "processing"
  | "failed";

export interface ImportStylePackTextRequestDTO {
  title: string;
  text: string;
  authConfirmed: boolean;
}

export interface ImportStylePackVideoRequestDTO {
  title: string;
  fileId?: string;
  authConfirmed: boolean;
}

export interface StylePackListItemDTO {
  stylePackId: string;
  name: string;
  sourceType: StylePackSourceTypeDTO;
  status: StylePackStatusDTO;
  version?: number;
  updatedAt?: string;
}

export interface StylePackDetailResponseDTO {
  stylePackId: string;
  name: string;
  sourceType: StylePackSourceTypeDTO;
  summaryText?: string;
  rulesJson?: Record<string, unknown>;
  promptProfile?: Record<string, unknown>;
  providerMeta?: ProviderMeta;
  transcriptText?: string;
  status: StylePackStatusDTO;
  version?: number;
  updatedAt?: string;
}

export interface UpdateStylePackRequestDTO {
  name?: string;
  summaryText?: string;
  rulesJson?: Record<string, unknown>;
  promptProfile?: Record<string, unknown>;
}
