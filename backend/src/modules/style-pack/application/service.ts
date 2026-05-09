import { randomUUID } from "crypto";
import { AppError } from "../../../app/common/errors";
import type { JsonValue } from "../../../app/common/persistence";
import type { PaginatedResult } from "../../../app/common/types";
import { loadConfig } from "../../../app/config";
import type {
  ExtractStylePackRulesCommand,
  ImportStylePackTextCommand,
  ImportStylePackVideoCommand,
  StylePackDetail,
  StylePackQuery,
  StylePackService,
  StylePackSummary,
  UpdateStylePackCommand
} from "./index";
import type { LlmGatewayService } from "../../llm-gateway";
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
  llmGatewayService?: LlmGatewayService;
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

  async importVideo(command: ImportStylePackVideoCommand): Promise<StylePackDetail> {
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

  async extractStructuredRules(
    command: ExtractStylePackRulesCommand
  ): Promise<StylePackDetail> {
    const record = await this.ensureStylePack(command.userId, command.stylePackId);
    if (!record.transcriptText || !record.transcriptText.trim()) {
      throw new AppError(
        "Style pack source text is not available for AI structuring",
        "INVALID_REQUEST",
        400
      );
    }

    const extraction = await this.extractTextStylePack(record.transcriptText);
    if (!extraction) {
      throw new AppError("AI structuring is currently unavailable", "INVALID_REQUEST", 400);
    }

    await this.deps.repository.updateStylePack(command.stylePackId, {
      summaryText: extraction.summaryText ?? record.summaryText ?? null,
      rulesJson: (extraction.rulesJson as JsonValue | undefined) ?? record.rulesJson ?? null,
      promptProfile:
        (extraction.promptProfile as JsonValue | undefined) ?? record.promptProfile ?? null,
      provider: extraction.providerMeta?.provider ?? null,
      modelName: extraction.providerMeta?.modelName ?? null,
      modelTier: extraction.providerMeta?.modelTier ?? null,
      version: record.version + 1,
      updatedAt: new Date()
    });

    const next = await this.ensureStylePack(command.userId, command.stylePackId);
    return mapStylePackRecordToDetail(next);
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

  private async extractTextStylePack(text: string): Promise<
    | {
        summaryText?: string;
        rulesJson?: Record<string, unknown>;
        promptProfile?: Record<string, unknown>;
        providerMeta?: {
          provider: string;
          modelName?: string;
          modelTier?: string;
        };
      }
    | undefined
  > {
    if (!this.deps.llmGatewayService || loadConfig().llm.providers.length === 0) {
      return undefined;
    }

    try {
      const result = await this.deps.llmGatewayService.invoke({
        taskType: "extract_style_pack",
        input: {
          messages: [
            {
              role: "system",
              content:
                "You extract detailed fashion style-pack knowledge from user-provided text. Preserve as much actionable information as possible. Return strict JSON with keys: summaryText, rulesJson, promptProfile. summaryText must be a rich Simplified Chinese summary around 120-220 Chinese characters, not overly compressed. rulesJson must be a JSON object and should keep granular arrays and fields when possible, such as preferred_colors, accent_colors, preferred_fit, silhouettes, lengths, materials, fabrics, styling_methods, layering, key_items, accessories, shoes, bags, occasions, scenes, seasons, avoid, dos, donts, keywords, mood, makeup, hairstyle. promptProfile must be a JSON object containing a reusable long-form styling profile in Simplified Chinese, including tone, persona, silhouette, color strategy, fabric/details, occasion guidance, and pairing suggestions."
            },
            {
              role: "user",
              content:
                "请从以下文本中提取风格包，并尽量完整保留穿搭偏好、禁忌、单品细节、场景、气质、色彩和搭配方法。不要过度摘要，不要只保留极少几个词。只返回 JSON。\n" +
                text
            }
          ],
          temperature: 0.2
        },
        outputSchema: {
          type: "object"
        }
      });

      const parsed = parseObjectLike(result);
      return {
        summaryText: asOptionalString(parsed.summaryText),
        rulesJson: asOptionalObject(parsed.rulesJson),
        promptProfile: asOptionalObject(parsed.promptProfile),
        providerMeta: result.providerMeta
      };
    } catch {
      return undefined;
    }
  }
}

export function createInMemoryStylePackService(
  deps: Partial<StylePackServiceDependencies> = {}
): StylePackService {
  return new InMemoryStylePackService({
    repository: deps.repository ?? createInMemoryStylePackRepository(),
    llmGatewayService: deps.llmGatewayService
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

function parseObjectLike(result: { output: Record<string, unknown>; rawText?: string }) {
  if (result.output && typeof result.output === "object" && !Array.isArray(result.output)) {
    const text = typeof result.output.text === "string" ? result.output.text : undefined;
    if (text) {
      try {
        return JSON.parse(stripCodeFence(text)) as Record<string, unknown>;
      } catch {
        return result.output;
      }
    }
    return result.output;
  }

  if (result.rawText) {
    try {
      return JSON.parse(stripCodeFence(result.rawText)) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  return {};
}

function stripCodeFence(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asOptionalObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
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
