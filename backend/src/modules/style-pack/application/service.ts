import { randomUUID } from "crypto";
import { AppError } from "../../../app/common/errors";
import type { JsonValue } from "../../../app/common/persistence";
import type { PaginatedResult } from "../../../app/common/types";
import type {
  ImportStylePackTextCommand,
  ImportStylePackVideoCommand,
  StylePackDetail,
  StylePackQuery,
  StylePackService,
  StylePackSummary,
  UpdateStylePackCommand
} from "./index";
import type { StylePackRepository } from "../infrastructure";
import {
  createInMemoryStylePackRepository,
  mapStylePackRecordToDetail,
  mapStylePackRecordToSummary
} from "../infrastructure";
import type { StylePackRecord } from "../infrastructure/persistence";

const DEFAULT_PAGE_NO = 1;
const DEFAULT_PAGE_SIZE = 20;

export interface StylePackServiceDependencies {
  repository: StylePackRepository;
}

export class InMemoryStylePackService implements StylePackService {
  constructor(private readonly deps: StylePackServiceDependencies) {}

  async importText(command: ImportStylePackTextCommand): Promise<StylePackDetail> {
    ensureAuthConfirmed(command.authConfirmed);
    const now = new Date();
    const record: StylePackRecord = {
      id: generateId(),
      userId: command.userId,
      name: command.title,
      sourceType: "text",
      sourceFileUrl: null,
      transcriptText: command.text,
      summaryText: null,
      rulesJson: null,
      promptProfile: null,
      version: 1,
      status: "draft",
      activatedAt: null,
      provider: null,
      modelName: null,
      modelTier: null,
      createdAt: now,
      updatedAt: now
    };

    await this.deps.repository.saveStylePack(record);
    return mapStylePackRecordToDetail(record);
  }

  async importVideo(
    command: ImportStylePackVideoCommand
  ): Promise<StylePackDetail> {
    ensureAuthConfirmed(command.authConfirmed);
    const now = new Date();
    const record: StylePackRecord = {
      id: generateId(),
      userId: command.userId,
      name: command.title,
      sourceType: "video",
      sourceFileUrl: buildSourceUrl(command.fileId),
      transcriptText: null,
      summaryText: null,
      rulesJson: null,
      promptProfile: null,
      version: 1,
      status: "draft",
      activatedAt: null,
      provider: null,
      modelName: null,
      modelTier: null,
      createdAt: now,
      updatedAt: now
    };

    await this.deps.repository.saveStylePack(record);
    return mapStylePackRecordToDetail(record);
  }

  async list(
    userId: string,
    query: StylePackQuery
  ): Promise<PaginatedResult<StylePackSummary>> {
    const records = await this.deps.repository.listStylePacksByUserId(userId);
    const filtered = records.filter((record) => matchesFilters(record, query));
    const pageNo = query.pageNo ?? DEFAULT_PAGE_NO;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const start = (pageNo - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    return {
      items: paged.map((record) => mapStylePackRecordToSummary(record)),
      pageNo,
      pageSize,
      total: filtered.length
    };
  }

  async getDetail(userId: string, stylePackId: string): Promise<StylePackDetail> {
    const record = await this.ensureStylePack(userId, stylePackId);
    return mapStylePackRecordToDetail(record);
  }

  async update(command: UpdateStylePackCommand): Promise<StylePackDetail> {
    const record = await this.ensureStylePack(command.userId, command.stylePackId);
    const patch: Partial<StylePackRecord> = {};
    let shouldBumpVersion = false;

    if (command.name !== undefined) {
      patch.name = command.name;
    }
    if (command.summaryText !== undefined) {
      patch.summaryText = command.summaryText;
      shouldBumpVersion = true;
    }
    if (command.rulesJson !== undefined) {
      patch.rulesJson = command.rulesJson as JsonValue;
      shouldBumpVersion = true;
    }
    if (command.promptProfile !== undefined) {
      patch.promptProfile = command.promptProfile as JsonValue;
      shouldBumpVersion = true;
    }

    if (shouldBumpVersion) {
      patch.version = record.version + 1;
    }

    patch.updatedAt = new Date();

    await this.deps.repository.updateStylePack(command.stylePackId, patch);
    const next = await this.ensureStylePack(command.userId, command.stylePackId);
    return mapStylePackRecordToDetail(next);
  }

  async activate(userId: string, stylePackId: string): Promise<StylePackDetail> {
    await this.ensureStylePack(userId, stylePackId);
    const now = new Date();

    await this.deps.repository.updateStylePack(stylePackId, {
      status: "active",
      activatedAt: now,
      updatedAt: now
    });

    const next = await this.ensureStylePack(userId, stylePackId);
    return mapStylePackRecordToDetail(next);
  }

  async deactivate(userId: string, stylePackId: string): Promise<StylePackDetail> {
    await this.ensureStylePack(userId, stylePackId);
    const now = new Date();

    await this.deps.repository.updateStylePack(stylePackId, {
      status: "inactive",
      activatedAt: null,
      updatedAt: now
    });

    const next = await this.ensureStylePack(userId, stylePackId);
    return mapStylePackRecordToDetail(next);
  }

  private async ensureStylePack(
    userId: string,
    stylePackId: string
  ): Promise<StylePackRecord> {
    const record = await this.deps.repository.findById(stylePackId);
    if (!record || record.userId !== userId) {
      throw new AppError("Style pack not found", "NOT_FOUND", 404);
    }
    return record;
  }
}

export function createInMemoryStylePackService(
  deps: Partial<StylePackServiceDependencies> = {}
): StylePackService {
  return new InMemoryStylePackService({
    repository: deps.repository ?? createInMemoryStylePackRepository()
  });
}

function ensureAuthConfirmed(authConfirmed: boolean): void {
  if (!authConfirmed) {
    throw new AppError("Auth confirmation required", "INVALID_REQUEST", 400);
  }
}

function buildSourceUrl(fileId?: string): string {
  if (fileId) {
    return `file://${fileId}`;
  }
  return "unknown://source";
}

function matchesFilters(record: StylePackRecord, query: StylePackQuery): boolean {
  if (query.status && record.status !== query.status) {
    return false;
  }
  if (query.sourceType && record.sourceType !== query.sourceType) {
    return false;
  }
  return true;
}

function generateId(): string {
  try {
    return randomUUID();
  } catch (error) {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
