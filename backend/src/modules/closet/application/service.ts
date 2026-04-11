import { randomUUID } from "crypto";
import { AppError } from "../../../app/common/errors";
import { loadConfig } from "../../../app/config";
import type { PaginatedResult } from "../../../app/common/types";
import type {
  ClothingAttributes,
  ClothingItemDetail,
  ClothingItemStatus,
  ClothingItemSummary,
  ClosetQueryFilters,
  ClosetService,
  ConfirmClothingItemCommand,
  UpdateClothingItemCommand,
  UploadClothingItemCommand,
  UploadClothingItemResult
} from "./index";
import type { TaskCenterService } from "../../task-center";
import type { LlmGatewayService } from "../../llm-gateway";
import type { ClosetRepository } from "../infrastructure";
import {
  createInMemoryClosetRepository,
  mapClothingRecordToDetail,
  mapClothingRecordToSummary
} from "../infrastructure";
import type { ClothingItemRecord } from "../infrastructure/persistence";

const DEFAULT_PAGE_NO = 1;
const DEFAULT_PAGE_SIZE = 20;

export interface ClosetServiceDependencies {
  repository: ClosetRepository;
  taskCenterService: TaskCenterService;
  llmGatewayService?: LlmGatewayService;
}

export class InMemoryClosetService implements ClosetService {
  constructor(private readonly deps: ClosetServiceDependencies) {}

  async uploadItem(command: UploadClothingItemCommand): Promise<UploadClothingItemResult> {
    const now = new Date();
    const itemId = generateId();
    const accessKey = generateId();
    const imageAsset = buildImageAsset(command);
    const remoteImageUrl = isPersistableRemoteUrl(command.fileId)
      ? command.fileId
      : undefined;
    const extraction = await this.extractAttributes(command, imageAsset);
    const record: ClothingItemRecord = {
      id: itemId,
      userId: command.userId,
      imageOriginalUrl: buildImageUrl(
        command.userId,
        itemId,
        accessKey,
        imageAsset,
        remoteImageUrl
      ),
      imageAccessKey: imageAsset ? accessKey : null,
      category: extraction?.attributes.category ?? null,
      subCategory: extraction?.attributes.subCategory ?? null,
      colors: extraction?.attributes.colors ?? null,
      pattern: extraction?.attributes.pattern ?? null,
      material: extraction?.attributes.material ?? null,
      fit: extraction?.attributes.fit ?? null,
      length: extraction?.attributes.length ?? null,
      seasons: extraction?.attributes.seasons ?? null,
      tags: extraction?.attributes.tags ?? null,
      occasionTags: extraction?.attributes.occasionTags ?? null,
      llmConfidence: extraction?.attributes.confidence ?? null,
      status: "pending_review",
      sourceType: command.sourceType,
      confirmedAt: null,
      provider: extraction?.providerMeta?.provider ?? null,
      modelName: extraction?.providerMeta?.modelName ?? null,
      modelTier: extraction?.providerMeta?.modelTier ?? null,
      retryCount: extraction?.providerMeta?.retryCount ?? null,
      createdAt: now,
      updatedAt: now
    };

    await this.deps.repository.saveItem(record);
    if (imageAsset) {
      await this.deps.repository.saveItemImage({
        itemId,
        contentType: imageAsset.contentType,
        byteSize: imageAsset.bytes.byteLength,
        bytes: imageAsset.bytes,
        createdAt: now,
        updatedAt: now
      });
    }

    const task = await this.deps.taskCenterService.createTask({
      taskType: "extract_clothing_attributes",
      payload: {
        itemId,
        userId: command.userId,
        fileId: command.fileId,
        originalFilename: command.originalFilename,
        sourceType: command.sourceType
      },
      requesterId: command.userId
    });

    return {
      itemId,
      taskId: task.taskId,
      status: task.status
    };
  }

  private async extractAttributes(
    command: UploadClothingItemCommand,
    imageAsset: { bytes: Buffer; contentType: string } | null
  ): Promise<
    | {
        attributes: Partial<ClothingAttributes>;
        providerMeta?: {
          provider: string;
          modelName?: string;
          modelTier?: string;
          retryCount?: number;
        };
      }
    | undefined
  > {
    if (!this.deps.llmGatewayService || !imageAsset || loadConfig().llm.providers.length === 0) {
      return undefined;
    }

    try {
      const imageDataUrl = `data:${imageAsset.contentType};base64,${command.fileContentBase64}`;
      const result = await this.deps.llmGatewayService.invoke({
        taskType: "extract_clothing_attributes",
        input: {
          messages: [
            {
              role: "system",
              content:
                "You extract clothing attributes from a single garment image. Return strict JSON with keys: category, subCategory, colors, pattern, material, fit, length, seasons, tags, occasionTags, confidence. Use arrays for colors/fit/seasons/tags/occasionTags. If unsure, omit fields."
            },
            {
              role: "user",
              content: [
                { type: "text", text: "Analyze this clothing item image and return only JSON." },
                { type: "image_url", image_url: { url: imageDataUrl } }
              ]
            }
          ],
          temperature: 0
        },
        outputSchema: {
          type: "object"
        }
      });

      const parsed = parseObjectLike(result);
      return {
        attributes: {
          category: asOptionalString(parsed.category),
          subCategory: asOptionalString(parsed.subCategory),
          colors: asOptionalStringArray(parsed.colors),
          pattern: asOptionalString(parsed.pattern),
          material: asOptionalString(parsed.material),
          fit: asOptionalStringArray(parsed.fit),
          length: asOptionalString(parsed.length),
          seasons: asOptionalStringArray(parsed.seasons),
          tags: asOptionalStringArray(parsed.tags),
          occasionTags: asOptionalStringArray(parsed.occasionTags),
          confidence: asOptionalConfidence(parsed.confidence)
        },
        providerMeta: result.providerMeta
      };
    } catch {
      return undefined;
    }
  }

  async listItems(
    userId: string,
    query: ClosetQueryFilters
  ): Promise<PaginatedResult<ClothingItemSummary>> {
    const items = await this.deps.repository.listItemsByUserId(userId);
    const filtered = items.filter((item) => matchesFilters(item, query));
    const pageNo = query.pageNo ?? DEFAULT_PAGE_NO;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const start = (pageNo - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    return {
      items: paged.map((item) => mapClothingRecordToSummary(item)),
      pageNo,
      pageSize,
      total: filtered.length
    };
  }

  async getItem(userId: string, itemId: string): Promise<ClothingItemDetail> {
    const record = await this.ensureItem(userId, itemId);
    return mapClothingRecordToDetail(record);
  }

  async getItemImage(
    userId: string,
    itemId: string,
    accessKey: string
  ): Promise<{ bytes: Buffer; contentType: string }> {
    const record = await this.ensureItem(userId, itemId);
    if (!record.imageAccessKey || record.imageAccessKey !== accessKey) {
      throw new AppError("Image not found", "NOT_FOUND", 404);
    }

    const image = await this.deps.repository.findItemImageByItemId(itemId);
    if (!image) {
      throw new AppError("Image not found", "NOT_FOUND", 404);
    }

    return {
      bytes: image.bytes,
      contentType: image.contentType
    };
  }

  async updateItem(command: UpdateClothingItemCommand): Promise<ClothingItemDetail> {
    const record = await this.ensureItem(command.userId, command.itemId);
    const patch = buildAttributePatch(command.attributes);

    await this.deps.repository.updateItem(command.itemId, {
      ...patch,
      updatedAt: new Date()
    });

    const next = await this.ensureItem(command.userId, command.itemId);
    return mapClothingRecordToDetail(next);
  }

  async confirmItem(command: ConfirmClothingItemCommand): Promise<ClothingItemDetail> {
    const record = await this.ensureItem(command.userId, command.itemId);
    if (record.status !== "pending_review") {
      throw new AppError("Item status does not allow confirmation", "INVALID_STATE", 400);
    }

    if (!hasRequiredAttributes(record)) {
      throw new AppError("Missing required attributes", "INVALID_REQUEST", 400);
    }

    await this.deps.repository.updateItem(command.itemId, {
      status: "active",
      confirmedAt: new Date(),
      updatedAt: new Date()
    });

    const next = await this.ensureItem(command.userId, command.itemId);
    return mapClothingRecordToDetail(next);
  }

  async archiveItem(userId: string, itemId: string): Promise<void> {
    await this.ensureItem(userId, itemId);
    await this.deps.repository.updateItem(itemId, {
      status: "archived",
      updatedAt: new Date()
    });
  }

  async deleteItem(userId: string, itemId: string): Promise<void> {
    await this.ensureItem(userId, itemId);
    await this.deps.repository.updateItem(itemId, {
      status: "deleted",
      updatedAt: new Date()
    });
  }

  private async ensureItem(userId: string, itemId: string): Promise<ClothingItemRecord> {
    const record = await this.deps.repository.findItemById(itemId);
    if (!record || record.userId !== userId) {
      throw new AppError("Item not found", "NOT_FOUND", 404);
    }
    return record;
  }
}

function parseObjectLike(result: { output: Record<string, unknown>; rawText?: string }) {
  if (result.output && typeof result.output === "object" && !Array.isArray(result.output)) {
    const text = typeof result.output.text === "string" ? result.output.text : undefined;
    if (text) {
      try {
        return JSON.parse(text) as Record<string, unknown>;
      } catch {
        return result.output;
      }
    }
    return result.output;
  }

  if (result.rawText) {
    try {
      return JSON.parse(result.rawText) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  return {};
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asOptionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const list = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return list.length > 0 ? list : undefined;
}

function asOptionalConfidence(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const entries = Object.entries(value).filter(([, entry]) => typeof entry === "number");
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function createInMemoryClosetService(
  deps: Pick<ClosetServiceDependencies, "taskCenterService"> &
    Partial<Pick<ClosetServiceDependencies, "repository" | "llmGatewayService">>
): ClosetService {
  return new InMemoryClosetService({
    repository: deps.repository ?? createInMemoryClosetRepository(),
    taskCenterService: deps.taskCenterService,
    llmGatewayService: deps.llmGatewayService
  });
}

function buildImageUrl(
  userId: string,
  itemId: string,
  accessKey: string,
  imageAsset: { bytes: Buffer; contentType: string } | null,
  remoteImageUrl?: string
): string {
  if (remoteImageUrl) {
    return remoteImageUrl;
  }
  if (!imageAsset) {
    return "";
  }

  const config = loadConfig();
  const query = new URLSearchParams({ userId, key: accessKey });
  return `${config.publicBaseUrl}/api/closet/items/${itemId}/image?${query.toString()}`;
}

function isPersistableRemoteUrl(value?: string): value is string {
  return !!value && (value.startsWith("http://") || value.startsWith("https://"));
}

function buildImageAsset(
  command: UploadClothingItemCommand
): { bytes: Buffer; contentType: string } | null {
  if (!command.fileContentBase64) {
    return null;
  }

  const config = loadConfig();
  const bytes = Buffer.from(command.fileContentBase64, "base64");
  if (bytes.byteLength === 0) {
    throw new AppError("Image content is empty", "INVALID_REQUEST", 400);
  }
  if (bytes.byteLength > config.maxUploadBytes) {
    throw new AppError("Uploaded image is too large", "INVALID_REQUEST", 400);
  }

  const contentType = normalizeContentType(command.fileContentType);
  return { bytes, contentType };
}

function normalizeContentType(value?: string): string {
  switch (value) {
    case "image/jpeg":
    case "image/png":
    case "image/webp":
      return value;
    default:
      return "image/jpeg";
  }
}

function buildAttributePatch(
  attributes: Partial<ClothingAttributes>
): Partial<ClothingItemRecord> {
  const patch: Partial<ClothingItemRecord> = {};

  if (attributes.category !== undefined) {
    patch.category = attributes.category;
  }
  if (attributes.subCategory !== undefined) {
    patch.subCategory = attributes.subCategory;
  }
  if (attributes.colors !== undefined) {
    patch.colors = attributes.colors;
  }
  if (attributes.pattern !== undefined) {
    patch.pattern = attributes.pattern;
  }
  if (attributes.material !== undefined) {
    patch.material = attributes.material;
  }
  if (attributes.fit !== undefined) {
    patch.fit = attributes.fit;
  }
  if (attributes.length !== undefined) {
    patch.length = attributes.length;
  }
  if (attributes.seasons !== undefined) {
    patch.seasons = attributes.seasons;
  }
  if (attributes.tags !== undefined) {
    patch.tags = attributes.tags;
  }
  if (attributes.occasionTags !== undefined) {
    patch.occasionTags = attributes.occasionTags;
  }
  if (attributes.confidence !== undefined) {
    patch.llmConfidence = attributes.confidence;
  }

  return patch;
}

function matchesFilters(record: ClothingItemRecord, query: ClosetQueryFilters): boolean {
  if (record.status === "deleted") {
    return false;
  }
  if (query.category && record.category !== query.category) {
    return false;
  }
  if (query.status && record.status !== mapStatusToRecord(query.status)) {
    return false;
  }
  if (query.tag) {
    const tags = coerceStringArray(record.tags);
    if (!tags.includes(query.tag)) {
      return false;
    }
  }
  if (query.season) {
    const seasons = coerceStringArray(record.seasons);
    if (!seasons.includes(query.season)) {
      return false;
    }
  }
  return true;
}

function mapStatusToRecord(status: ClothingItemStatus): ClothingItemRecord["status"] {
  switch (status) {
    case "needs_review":
      return "pending_review";
    case "active":
      return "active";
    case "archived":
      return "archived";
    case "deleted":
      return "deleted";
    case "uploaded":
      return "pending_review";
    default:
      return "pending_review";
  }
}

function coerceStringArray(value?: unknown | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function hasRequiredAttributes(record: ClothingItemRecord): boolean {
  const hasCategory = typeof record.category === "string" && record.category.length > 0;
  const colors = coerceStringArray(record.colors);
  const seasons = coerceStringArray(record.seasons);
  return hasCategory && colors.length > 0 && seasons.length > 0;
}

function generateId(): string {
  try {
    return randomUUID();
  } catch (error) {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
