import { randomUUID } from "crypto";
import { AppError } from "../../../app/common/errors";
import { loadConfig } from "../../../app/config";
import type { PaginatedResult } from "../../../app/common/types";
import type {
  ApplyClothingItemCutoutCommand,
  ClothingAttributes,
  ClothingItemCutoutPreview,
  ClothingItemDetail,
  ClothingItemStatus,
  ClothingItemSummary,
  ClosetQueryFilters,
  ClosetService,
  ConfirmClothingItemCommand,
  ExtractClothingItemAttributesCommand,
  PreviewClothingItemCutoutCommand,
  UpdateClothingItemCommand,
  UploadClothingItemCommand,
  UploadClothingItemResult
} from "./index";
import type { TaskCenterService } from "../../task-center";
import type { LlmGatewayService } from "../../llm-gateway";
import type { TaskRepository } from "../../task-center/infrastructure";
import type { UserProfileRepository } from "../../user-profile/infrastructure";
import type { ClosetRepository } from "../infrastructure";
import {
  createInMemoryClosetRepository,
  mapClothingRecordToDetail,
  mapClothingRecordToSummary
} from "../infrastructure";
import type { ClothingItemRecord } from "../infrastructure/persistence";

const DEFAULT_PAGE_NO = 1;
const DEFAULT_PAGE_SIZE = 20;
const LEGACY_DAILY_EXTRACTION_LIMIT_EXEMPT_IDENTIFIERS = new Set([
  "chenyiwang0413",
  "wxid_ipku9na2mb4712"
]);

export interface ClosetServiceDependencies {
  repository: ClosetRepository;
  taskCenterService: TaskCenterService;
  taskRepository?: TaskRepository;
  userProfileRepository?: UserProfileRepository;
  llmGatewayService?: LlmGatewayService;
}

export class InMemoryClosetService implements ClosetService {
  constructor(private readonly deps: ClosetServiceDependencies) {}

  private getManualExtractionDailyLimit(): number {
    return Math.max(0, loadConfig().quota.aiExtractionDailyLimit || 0);
  }

  async uploadItem(command: UploadClothingItemCommand): Promise<UploadClothingItemResult> {
    const now = new Date();
    const itemId = generateId();
    const accessKey = generateId();
    const imageAsset = buildImageAsset(command);
    const remoteImageUrl = isPersistableRemoteUrl(command.fileId)
      ? command.fileId
      : undefined;
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
      category: null,
      subCategory: null,
      colors: null,
      pattern: null,
      material: null,
      fit: null,
      length: null,
      seasons: null,
      tags: null,
      occasionTags: null,
      llmConfidence: null,
      status: "pending_review",
      sourceType: command.sourceType,
      confirmedAt: null,
      provider: null,
      modelName: null,
      modelTier: null,
      retryCount: null,
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

    return {
      itemId,
      status: "needs_review"
    };
  }

  private async extractAttributesWithLlm(
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
                "You extract clothing attributes from a single garment image. Only identify clothing, shoes, bags, or accessories. If the image is not a wearable fashion item, leave category empty. Return strict JSON with keys: category, subCategory, colors, pattern, material, fit, length, seasons, tags, occasionTags, confidence. Use arrays for colors/fit/seasons/tags/occasionTags. IMPORTANT: all attribute values must be in Simplified Chinese only. Never return English labels such as top, pants, outerwear, dress, shoes, accessory, black, white, spring, summer, casual, minimal. If unsure, omit fields."
            },
            {
              role: "user",
              content: [
                { type: "text", text: "请识别这张图片中的服饰属性，只返回 JSON，且所有字段值必须使用简体中文。若不是衣物/鞋包/配饰，请不要胡乱识别。" },
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
      const normalized = normalizeExtractedAttributes(parsed);
      return {
        attributes: normalized,
        providerMeta: result.providerMeta
      };
    } catch {
      return undefined;
    }
  }

  private async extractAttributesWithSkillCenter(input: {
    record: ClothingItemRecord;
    imageAsset: { bytes: Buffer; contentType: string };
    recognitionType: "clothes" | "jewelry";
    engine?: "auto" | "fashion_clip" | "clip" | "rules";
  }): Promise<{
    attributes: Partial<ClothingAttributes>;
    providerMeta: {
      provider: string;
      modelName?: string;
      modelTier?: string;
      retryCount?: number;
      confidence?: Record<string, number>;
    };
  }> {
    const result = await requestClothesAttribute({
      bytes: input.imageAsset.bytes,
      contentType: input.imageAsset.contentType,
      filename: buildImageFilename(input.record, input.imageAsset.contentType),
      recognitionType: input.recognitionType,
      engine: input.engine,
      topK: 3,
      attributeThreshold: 0.18
    });

    const normalized = normalizeSkillCenterAttributes(result);
    return {
      attributes: normalized,
      providerMeta: {
        provider: "skill-center",
        modelName: result.modelName,
        modelTier: result.engine,
        retryCount: 0,
        confidence: normalized.confidence
      }
    };
  }

  async extractItemAttributes(
    command: ExtractClothingItemAttributesCommand
  ): Promise<ClothingItemDetail> {
    await this.ensureManualExtractionQuota(command.userId, new Date());

    const record = await this.ensureItem(command.userId, command.itemId);
    const recognitionType =
      command.recognitionType ?? inferAttributeRecognitionType(record);
    if (!recognitionType) {
      throw new AppError(
        "Please choose item category before requesting AI extraction.",
        "INVALID_REQUEST",
        400
      );
    }
    const image = await this.getItemImageAsset(record);
    if (!image) {
      throw new AppError("Item image is not available for AI extraction", "INVALID_REQUEST", 400);
    }

    const task = await this.deps.taskCenterService.createTask({
      taskType: "extract_clothing_attributes",
      payload: {
        itemId: command.itemId,
        userId: command.userId,
        recognitionType,
        engine: command.engine ?? "fashion_clip"
      },
      requesterId: command.userId,
      bizType: "closet_item",
      bizId: command.itemId,
      maxAttempts: 1
    });

    await this.deps.taskCenterService.updateTask({
      taskId: task.taskId,
      status: "processing",
      progress: 10,
      resultSummary: "AI extraction started",
      lockedAt: new Date(),
      lockedBy: "api-manual"
    });

    try {
      const extraction = await this.extractAttributesWithSkillCenter({
        record,
        imageAsset: image,
        recognitionType,
        engine: command.engine
      });

      await this.deps.repository.updateItem(command.itemId, {
        category: extraction.attributes.category ?? record.category ?? null,
        subCategory: extraction.attributes.subCategory ?? record.subCategory ?? null,
        colors: extraction.attributes.colors ?? record.colors ?? null,
        pattern: extraction.attributes.pattern ?? record.pattern ?? null,
        material: extraction.attributes.material ?? record.material ?? null,
        fit: extraction.attributes.fit ?? record.fit ?? null,
        length: extraction.attributes.length ?? record.length ?? null,
        seasons: extraction.attributes.seasons ?? record.seasons ?? null,
        tags: extraction.attributes.tags ?? record.tags ?? null,
        occasionTags: extraction.attributes.occasionTags ?? record.occasionTags ?? null,
        llmConfidence: extraction.attributes.confidence ?? record.llmConfidence ?? null,
        provider: extraction.providerMeta?.provider ?? null,
        modelName: extraction.providerMeta?.modelName ?? null,
        modelTier: extraction.providerMeta?.modelTier ?? null,
        retryCount: extraction.providerMeta?.retryCount ?? null,
        updatedAt: new Date()
      });

      await this.deps.taskCenterService.updateTask({
        taskId: task.taskId,
        status: "completed",
        progress: 100,
        resultSummary: "Clothing attributes extracted",
        resultPayload: { itemId: command.itemId },
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null
      });

      const next = await this.ensureItem(command.userId, command.itemId);
      return this.enrichDetailWithQuota(command.userId, mapClothingRecordToDetail(next));
    } catch (error) {
      await this.deps.taskCenterService.updateTask({
        taskId: task.taskId,
        status: "failed",
        progress: 100,
        errorCode: "TASK_FATAL",
        errorMessage:
          error instanceof Error ? error.message : "Clothing extraction failed",
        finishedAt: new Date(),
        lockedAt: null,
        lockedBy: null
      });
      throw error;
    }
  }

  private async ensureManualExtractionQuota(userId: string, now: Date): Promise<void> {
    if (!this.deps.taskRepository) {
      return;
    }

    const dailyLimit = this.getManualExtractionDailyLimit();
    if (dailyLimit <= 0) {
      return;
    }

    if (await this.isExtractionQuotaExemptUser(userId)) {
      return;
    }

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const todayCount = await this.deps.taskRepository.countCreatedByUserAndTypeSince(
      userId,
      "extract_clothing_attributes",
      startOfDay
    );

    if (todayCount >= dailyLimit) {
      throw new AppError(
        `今日 AI 识别次数已用完，每天最多 ${dailyLimit} 次。`,
        "INVALID_REQUEST",
        400
      );
    }
  }

  private async isExtractionQuotaExemptUser(userId: string): Promise<boolean> {
    const config = loadConfig();
    const normalizedUserId = normalizeIdentifier(userId);
    if (
      config.quota.aiExtractionExemptUserIds
        .map(normalizeIdentifier)
        .includes(normalizedUserId) ||
      LEGACY_DAILY_EXTRACTION_LIMIT_EXEMPT_IDENTIFIERS.has(normalizedUserId)
    ) {
      return true;
    }

    if (!this.deps.userProfileRepository) {
      return false;
    }

    const user = await this.deps.userProfileRepository.findById(userId);
    const wechatOpenId = normalizeIdentifier(user?.wechatOpenId);
    const unionId = normalizeIdentifier(user?.unionId);

    const exemptOpenIds = config.quota.aiExtractionExemptWechatOpenIds.map(normalizeIdentifier);
    const exemptUnionIds = config.quota.aiExtractionExemptUnionIds.map(normalizeIdentifier);

    return Boolean(
      (wechatOpenId &&
        (exemptOpenIds.includes(wechatOpenId) ||
          LEGACY_DAILY_EXTRACTION_LIMIT_EXEMPT_IDENTIFIERS.has(wechatOpenId))) ||
      (unionId && exemptUnionIds.includes(unionId))
    );
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
    return this.enrichDetailWithQuota(userId, mapClothingRecordToDetail(record));
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

    const image = await this.getItemImageAsset(record);
    if (!image) {
      throw new AppError("Image not found", "NOT_FOUND", 404);
    }

    return {
      bytes: image.bytes,
      contentType: image.contentType
    };
  }

  async previewItemCutout(
    command: PreviewClothingItemCutoutCommand
  ): Promise<ClothingItemCutoutPreview> {
    const record = await this.ensureItem(command.userId, command.itemId);
    const recognitionType =
      command.recognitionType ?? inferCutoutRecognitionType(record);
    if (!recognitionType) {
      throw new AppError(
        "Please choose item category before requesting cutout.",
        "INVALID_REQUEST",
        400
      );
    }
    const image =
      (await this.getItemImageAsset(record)) ??
      (await this.persistCommandSourceImage(record, command));
    if (!image) {
      throw new AppError(
        "Item image is not available for cutout. Please re-upload or replace the image first.",
        "INVALID_REQUEST",
        400
      );
    }

    const result = await requestClothesCutout({
      bytes: image.bytes,
      contentType: image.contentType,
      filename: buildImageFilename(record, image.contentType),
      recognitionType,
      engine: command.engine,
      keepCanvas: command.keepCanvas,
      saveMask: command.saveMask
    });

    return {
      itemId: command.itemId,
      previewImageBase64: result.outputBytes.toString("base64"),
      previewContentType: result.outputContentType,
      previewFilename: result.outputFilename,
      engineRequested: result.engineRequested,
      engineUsed: result.engineUsed,
      transparentBackground: result.transparentBackground
    };
  }

  async applyItemCutout(
    command: ApplyClothingItemCutoutCommand
  ): Promise<ClothingItemDetail> {
    const record = await this.ensureItem(command.userId, command.itemId);
    const now = new Date();
    const nextBytes = Buffer.from(command.imageBase64, "base64");
    if (nextBytes.byteLength === 0) {
      throw new AppError("Cutout image content is empty", "INVALID_REQUEST", 400);
    }

    const contentType = normalizeContentType(command.contentType);
    const imageAccessKey = generateId();
    await this.deps.repository.saveItemImage({
      itemId: command.itemId,
      contentType,
      byteSize: nextBytes.byteLength,
      bytes: nextBytes,
      createdAt: now,
      updatedAt: now
    });

    await this.deps.repository.updateItem(command.itemId, {
      imageOriginalUrl: buildImageUrl(
        command.userId,
        command.itemId,
        imageAccessKey,
        { bytes: nextBytes, contentType }
      ),
      imageAccessKey,
      updatedAt: now
    });

    const next = await this.ensureItem(command.userId, command.itemId);
    return this.enrichDetailWithQuota(command.userId, mapClothingRecordToDetail(next));
  }

  async updateItem(command: UpdateClothingItemCommand): Promise<ClothingItemDetail> {
    const record = await this.ensureItem(command.userId, command.itemId);
    const patch = buildAttributePatch(command.attributes);

    await this.deps.repository.updateItem(command.itemId, {
      ...patch,
      updatedAt: new Date()
    });

    const next = await this.ensureItem(command.userId, command.itemId);
    return this.enrichDetailWithQuota(command.userId, mapClothingRecordToDetail(next));
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
    return this.enrichDetailWithQuota(command.userId, mapClothingRecordToDetail(next));
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

  private async getItemImageAsset(
    record: ClothingItemRecord
  ): Promise<{ bytes: Buffer; contentType: string } | null> {
    const stored = await this.deps.repository.findItemImageByItemId(record.id);
    if (stored) {
      return {
        bytes: stored.bytes,
        contentType: stored.contentType
      };
    }

    const remoteUrl = resolveRecoverableImageUrl(record.imageOriginalUrl);
    if (!remoteUrl) {
      return null;
    }

    try {
      const response = await fetch(remoteUrl);
      if (!response.ok) {
        return null;
      }

      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength === 0) {
        return null;
      }

      const contentType = normalizeContentType(response.headers.get("content-type") || undefined);
      const now = new Date();
      await this.deps.repository.saveItemImage({
        itemId: record.id,
        contentType,
        byteSize: bytes.byteLength,
        bytes,
        createdAt: now,
        updatedAt: now
      });

      return {
        bytes,
        contentType
      };
    } catch {
      return null;
    }
  }

  private async persistCommandSourceImage(
    record: ClothingItemRecord,
    command: PreviewClothingItemCutoutCommand
  ): Promise<{ bytes: Buffer; contentType: string } | null> {
    if (!command.sourceImageBase64) {
      return null;
    }

    const bytes = Buffer.from(command.sourceImageBase64, "base64");
    if (bytes.byteLength === 0) {
      return null;
    }

    const contentType = normalizeContentType(command.sourceContentType);
    const now = new Date();
    await this.deps.repository.saveItemImage({
      itemId: record.id,
      contentType,
      byteSize: bytes.byteLength,
      bytes,
      createdAt: now,
      updatedAt: now
    });

    if (!record.imageAccessKey) {
      const imageAccessKey = generateId();
      await this.deps.repository.updateItem(record.id, {
        imageAccessKey,
        imageOriginalUrl: buildImageUrl(
          record.userId,
          record.id,
          imageAccessKey,
          { bytes, contentType }
        ),
        updatedAt: now
      });
    }

    return {
      bytes,
      contentType
    };
  }

  private async enrichDetailWithQuota(
    userId: string,
    detail: ClothingItemDetail
  ): Promise<ClothingItemDetail> {
    return {
      ...detail,
      aiQuota: await this.buildAiQuotaSnapshot(userId)
    };
  }

  private async buildAiQuotaSnapshot(userId: string) {
    const dailyLimit = this.getManualExtractionDailyLimit();
    const unlimited = await this.isExtractionQuotaExemptUser(userId);
    if (!this.deps.taskRepository) {
      return {
        usedCount: 0,
        dailyLimit,
        remainingCount: unlimited ? null : dailyLimit,
        unlimited
      };
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const usedCount = await this.deps.taskRepository.countCreatedByUserAndTypeSince(
      userId,
      "extract_clothing_attributes",
      startOfDay
    );

    return {
      usedCount,
      dailyLimit,
      remainingCount: unlimited
        ? null
        : Math.max(dailyLimit - usedCount, 0),
      unlimited
    };
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

function normalizeIdentifier(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
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

function normalizeExtractedAttributes(
  parsed: Record<string, unknown>
): Partial<ClothingAttributes> {
  const categoryInfo = normalizeCategoryInfo(parsed);
  return {
    category: categoryInfo.category,
    subCategory: categoryInfo.subCategory,
    colors: normalizeArray(asOptionalStringArray(parsed.colors), normalizeColorValue),
    pattern: normalizeLabel(asOptionalString(parsed.pattern)),
    material: normalizeLabel(asOptionalString(parsed.material)),
    fit: normalizeArray(asOptionalStringArray(parsed.fit), normalizeFitValue),
    length: normalizeLabel(asOptionalString(parsed.length)),
    seasons: normalizeArray(asOptionalStringArray(parsed.seasons), normalizeSeasonValue),
    tags: normalizeArray(asOptionalStringArray(parsed.tags), normalizeTagValue),
    occasionTags: normalizeArray(asOptionalStringArray(parsed.occasionTags), normalizeTagValue),
    confidence: asOptionalConfidence(parsed.confidence)
  };
}

function normalizeCategoryInfo(
  parsed: Record<string, unknown>
): { category?: string; subCategory?: string } {
  const rawCategory = asOptionalString(parsed.category);
  const rawSubCategory = asOptionalString(parsed.subCategory);
  const rawTags = asOptionalStringArray(parsed.tags) ?? [];
  const rawOccasionTags = asOptionalStringArray(parsed.occasionTags) ?? [];

  const joinedHints = [rawCategory, rawSubCategory, ...rawTags, ...rawOccasionTags]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map(toLookupKey);

  if (joinedHints.some((value) => DECORATIVE_ACCESSORY_HINTS.has(value))) {
    return {
      category: "配饰",
      subCategory: normalizeDecorativeSubCategory(rawSubCategory ?? rawCategory) ?? "层搭装饰片"
    };
  }

  const category = normalizeCategoryValue(rawCategory);
  const subCategory = normalizeSubCategoryValue(rawSubCategory, category);
  return { category, subCategory };
}

function normalizeArray(
  list: string[] | undefined,
  mapper: (value: string) => string | undefined
): string[] | undefined {
  if (!list?.length) {
    return undefined;
  }
  const normalized = list
    .map(mapper)
    .filter((item): item is string => typeof item === "string" && item.length > 0);
  return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
}

function normalizeCategory(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = toKey(value);
  const mapping: Record<string, string> = {
    top: "上衣",
    tops: "上衣",
    tshirt: "上衣",
    shirt: "上衣",
    blouse: "上衣",
    sweater: "上衣",
    knitwear: "上衣",
    bottom: "下装",
    bottoms: "下装",
    pants: "下装",
    trousers: "下装",
    jeans: "下装",
    skirt: "下装",
    shorts: "下装",
    outerwear: "外套",
    coat: "外套",
    jacket: "外套",
    blazer: "外套",
    cardigan: "外套",
    dress: "连衣裙",
    dresses: "连衣裙",
    footwear: "鞋履",
    shoes: "鞋履",
    sneaker: "鞋履",
    sneakers: "鞋履",
    boots: "鞋履",
    sandals: "鞋履",
    bag: "包袋",
    bags: "包袋",
    handbag: "包袋",
    backpack: "包袋",
    accessory: "配饰",
    accessories: "配饰",
    jewelry: "配饰",
    hat: "配饰",
    scarf: "配饰",
    belt: "配饰"
  };

  return mapping[normalized];
}

function normalizeColor(value: string): string | undefined {
  const normalized = toKey(value);
  const mapping: Record<string, string> = {
    white: "白色",
    black: "黑色",
    gray: "灰色",
    grey: "灰色",
    blue: "蓝色",
    navy: "蓝色",
    beige: "米色",
    khaki: "卡其色",
    brown: "棕色",
    green: "绿色",
    red: "红色",
    pink: "粉色",
    purple: "紫色",
    yellow: "黄色",
    orange: "橙色",
    multicolor: "多色",
    multi: "多色"
  };
  return mapping[normalized];
}

function normalizeSeason(value: string): string | undefined {
  const normalized = toKey(value);
  const mapping: Record<string, string> = {
    spring: "春",
    summer: "夏",
    autumn: "秋",
    fall: "秋",
    winter: "冬"
  };
  return mapping[normalized];
}

function normalizeFit(value: string): string | undefined {
  const normalized = toKey(value);
  const mapping: Record<string, string> = {
    loose: "宽松",
    oversized: "宽松",
    relaxed: "宽松",
    slim: "修身",
    fitted: "修身",
    regular: "常规",
    straight: "直筒",
    cropped: "短款",
    long: "长款"
  };
  return mapping[normalized];
}

function normalizeTag(value: string): string | undefined {
  const normalized = toKey(value);
  const mapping: Record<string, string> = {
    minimal: "极简",
    minimalist: "极简",
    commute: "通勤",
    office: "通勤",
    basic: "基础款",
    casual: "休闲",
    versatile: "百搭",
    elegant: "优雅",
    sporty: "运动",
    vintage: "复古",
    streetwear: "街头",
    chic: "时髦"
  };
  return mapping[normalized];
}

function normalizeLabel(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.trim();
}

function toKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "")
    .replace(/[^a-z -]/g, "");
}

function normalizeCategoryValue(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const mapping: Record<string, string> = {
    top: "\u4e0a\u8863",
    tops: "\u4e0a\u8863",
    tshirt: "\u4e0a\u8863",
    shirt: "\u4e0a\u8863",
    blouse: "\u4e0a\u8863",
    sweater: "\u4e0a\u8863",
    knitwear: "\u4e0a\u8863",
    "\u4e0a\u8863": "\u4e0a\u8863",
    "\u4e0a\u88c5": "\u4e0a\u8863",
    "\u6064\u886b": "\u4e0a\u8863",
    "\u6bdb\u8863": "\u4e0a\u8863",
    bottom: "\u4e0b\u88c5",
    bottoms: "\u4e0b\u88c5",
    pants: "\u4e0b\u88c5",
    trousers: "\u4e0b\u88c5",
    jeans: "\u4e0b\u88c5",
    skirt: "\u4e0b\u88c5",
    shorts: "\u4e0b\u88c5",
    "\u4e0b\u88c5": "\u4e0b\u88c5",
    "\u88e4\u5b50": "\u4e0b\u88c5",
    "\u88d9\u5b50": "\u4e0b\u88c5",
    "\u77ed\u88e4": "\u4e0b\u88c5",
    "\u957f\u88e4": "\u4e0b\u88c5",
    outerwear: "\u5916\u5957",
    coat: "\u5916\u5957",
    jacket: "\u5916\u5957",
    blazer: "\u5916\u5957",
    cardigan: "\u5916\u5957",
    "\u5916\u5957": "\u5916\u5957",
    "\u5927\u8863": "\u5916\u5957",
    "\u5939\u514b": "\u5916\u5957",
    "\u5f00\u886b": "\u5916\u5957",
    dress: "\u8fde\u8863\u88d9",
    dresses: "\u8fde\u8863\u88d9",
    "\u8fde\u8863\u88d9": "\u8fde\u8863\u88d9",
    "\u8fde\u8eab\u88d9": "\u8fde\u8863\u88d9",
    "\u88d9\u88c5": "\u8fde\u8863\u88d9",
    footwear: "\u978b\u5c65",
    shoes: "\u978b\u5c65",
    sneaker: "\u978b\u5c65",
    sneakers: "\u978b\u5c65",
    boots: "\u978b\u5c65",
    sandals: "\u978b\u5c65",
    "\u978b\u5c65": "\u978b\u5c65",
    "\u978b\u5b50": "\u978b\u5c65",
    "\u8fd0\u52a8\u978b": "\u978b\u5c65",
    "\u9774\u5b50": "\u978b\u5c65",
    "\u51c9\u978b": "\u978b\u5c65",
    bag: "\u5305\u888b",
    bags: "\u5305\u888b",
    handbag: "\u5305\u888b",
    backpack: "\u5305\u888b",
    "\u5305\u888b": "\u5305\u888b",
    "\u5305": "\u5305\u888b",
    "\u624b\u63d0\u5305": "\u5305\u888b",
    "\u53cc\u80a9\u5305": "\u5305\u888b",
    accessory: "\u914d\u9970",
    accessories: "\u914d\u9970",
    jewelry: "\u914d\u9970",
    hat: "\u914d\u9970",
    scarf: "\u914d\u9970",
    belt: "\u914d\u9970",
    "\u914d\u9970": "\u914d\u9970",
    "\u9970\u54c1": "\u914d\u9970",
    "\u9996\u9970": "\u914d\u9970",
    "\u5e3d\u5b50": "\u914d\u9970",
    "\u56f4\u5dfe": "\u914d\u9970",
    "\u76ae\u5e26": "\u914d\u9970"
  };

  return mapWithAliases(value, mapping);
}

function normalizeColorValue(value: string): string | undefined {
  const mapping: Record<string, string> = {
    white: "\u767d\u8272",
    "\u767d": "\u767d\u8272",
    "\u767d\u8272": "\u767d\u8272",
    black: "\u9ed1\u8272",
    "\u9ed1": "\u9ed1\u8272",
    "\u9ed1\u8272": "\u9ed1\u8272",
    gray: "\u7070\u8272",
    grey: "\u7070\u8272",
    "\u7070": "\u7070\u8272",
    "\u7070\u8272": "\u7070\u8272",
    blue: "\u84dd\u8272",
    navy: "\u84dd\u8272",
    "\u84dd": "\u84dd\u8272",
    "\u84dd\u8272": "\u84dd\u8272",
    beige: "\u7c73\u8272",
    "\u7c73\u8272": "\u7c73\u8272",
    khaki: "\u5361\u5176\u8272",
    "\u5361\u5176": "\u5361\u5176\u8272",
    "\u5361\u5176\u8272": "\u5361\u5176\u8272",
    brown: "\u68d5\u8272",
    "\u68d5\u8272": "\u68d5\u8272",
    "\u8910\u8272": "\u68d5\u8272",
    green: "\u7eff\u8272",
    "\u7eff": "\u7eff\u8272",
    "\u7eff\u8272": "\u7eff\u8272",
    red: "\u7ea2\u8272",
    "\u7ea2": "\u7ea2\u8272",
    "\u7ea2\u8272": "\u7ea2\u8272",
    pink: "\u7c89\u8272",
    "\u7c89": "\u7c89\u8272",
    "\u7c89\u8272": "\u7c89\u8272",
    purple: "\u7d2b\u8272",
    "\u7d2b": "\u7d2b\u8272",
    "\u7d2b\u8272": "\u7d2b\u8272",
    yellow: "\u9ec4\u8272",
    "\u9ec4": "\u9ec4\u8272",
    "\u9ec4\u8272": "\u9ec4\u8272",
    orange: "\u6a59\u8272",
    "\u6a59": "\u6a59\u8272",
    "\u6a59\u8272": "\u6a59\u8272",
    multicolor: "\u591a\u8272",
    multi: "\u591a\u8272",
    "\u591a\u8272": "\u591a\u8272",
    "\u62fc\u8272": "\u591a\u8272",
    "\u5f69\u8272": "\u591a\u8272",
    "\u6d45\u84dd": "\u6d45\u84dd\u8272",
    "\u6d45\u84dd\u8272": "\u6d45\u84dd\u8272",
    "\u725b\u4ed4\u84dd": "\u725b\u4ed4\u84dd",
    "\u4e39\u5b81\u84dd": "\u725b\u4ed4\u84dd",
    "\u6df1\u84dd": "\u6df1\u84dd\u8272",
    "\u6df1\u84dd\u8272": "\u6df1\u84dd\u8272",
    "\u85cf\u84dd": "\u85cf\u84dd\u8272",
    "\u85cf\u84dd\u8272": "\u85cf\u84dd\u8272",
    "\u7c73\u767d": "\u7c73\u767d\u8272",
    "\u7c73\u767d\u8272": "\u7c73\u767d\u8272",
    "\u6df1\u7070": "\u6df1\u7070\u8272",
    "\u6df1\u7070\u8272": "\u6df1\u7070\u8272",
    "\u6d45\u7070": "\u6d45\u7070\u8272",
    "\u6d45\u7070\u8272": "\u6d45\u7070\u8272",
    "\u5496\u5561": "\u5496\u5561\u8272",
    "\u5496\u5561\u8272": "\u5496\u5561\u8272"
  };

  return mapping[toLookupKey(value)] ?? fallbackLabel(value);
}

function normalizeSeasonValue(value: string): string | undefined {
  const mapping: Record<string, string> = {
    spring: "\u6625",
    "\u6625": "\u6625",
    "\u6625\u5b63": "\u6625",
    summer: "\u590f",
    "\u590f": "\u590f",
    "\u590f\u5b63": "\u590f",
    autumn: "\u79cb",
    fall: "\u79cb",
    "\u79cb": "\u79cb",
    "\u79cb\u5b63": "\u79cb",
    winter: "\u51ac",
    "\u51ac": "\u51ac",
    "\u51ac\u5b63": "\u51ac"
  };

  return mapping[toLookupKey(value)];
}

function normalizeFitValue(value: string): string | undefined {
  const mapping: Record<string, string> = {
    loose: "\u5bbd\u677e",
    oversized: "\u5bbd\u677e",
    relaxed: "\u5bbd\u677e",
    "\u5bbd\u677e": "\u5bbd\u677e",
    slim: "\u4fee\u8eab",
    fitted: "\u4fee\u8eab",
    "\u4fee\u8eab": "\u4fee\u8eab",
    regular: "\u5e38\u89c4",
    "\u5e38\u89c4": "\u5e38\u89c4",
    straight: "\u76f4\u7b52",
    "\u76f4\u7b52": "\u76f4\u7b52",
    cropped: "\u77ed\u6b3e",
    "\u77ed\u6b3e": "\u77ed\u6b3e",
    long: "\u957f\u6b3e",
    "\u957f\u6b3e": "\u957f\u6b3e",
    "\u8d85\u957f": "\u957f\u6b3e"
  };

  return mapping[toLookupKey(value)];
}

function normalizeTagValue(value: string): string | undefined {
  const mapping: Record<string, string> = {
    minimal: "\u6781\u7b80",
    minimalist: "\u6781\u7b80",
    "\u6781\u7b80": "\u6781\u7b80",
    commute: "\u901a\u52e4",
    office: "\u901a\u52e4",
    "\u901a\u52e4": "\u901a\u52e4",
    basic: "\u57fa\u7840\u6b3e",
    "\u57fa\u7840\u6b3e": "\u57fa\u7840\u6b3e",
    casual: "\u4f11\u95f2",
    "\u4f11\u95f2": "\u4f11\u95f2",
    versatile: "\u767e\u642d",
    "\u767e\u642d": "\u767e\u642d",
    elegant: "\u4f18\u96c5",
    "\u4f18\u96c5": "\u4f18\u96c5",
    sporty: "\u8fd0\u52a8",
    "\u8fd0\u52a8": "\u8fd0\u52a8",
    vintage: "\u590d\u53e4",
    "\u590d\u53e4": "\u590d\u53e4",
    streetwear: "\u8857\u5934",
    "\u8857\u5934": "\u8857\u5934",
    chic: "\u65f6\u9ae6",
    "\u65f6\u9ae6": "\u65f6\u9ae6",
    "\u751c\u9177": "\u751c\u9177",
    "\u7b80\u7ea6": "\u7b80\u7ea6",
    "\u6162\u677e": "\u6162\u677e",
    "\u6162\u61d2": "\u6162\u61d2",
    "\u77e5\u6027": "\u77e5\u6027",
    "\u6cd5\u5f0f": "\u6cd5\u5f0f",
    "\u97e9\u7cfb": "\u97e9\u7cfb",
    "\u65e5\u5e38": "\u65e5\u5e38",
    "\u5c71\u7cfb": "\u5c71\u7cfb",
    "\u5de5\u88c5": "\u5de5\u88c5",
    "\u77e5\u8bc6\u5206\u5b50": "\u77e5\u8bc6\u5206\u5b50"
  };

  return mapping[toLookupKey(value)] ?? fallbackLabel(value);
}

function normalizeSubCategoryValue(
  value?: string,
  category?: string
): string | undefined {
  if (!value) {
    return category === "配饰" ? undefined : undefined;
  }

  const normalized = toLookupKey(value);
  const mapping: Record<string, string> = {
    腰饰: "腰饰",
    腰链: "腰饰",
    腰封: "腰饰",
    beltaccessory: "腰饰",
    屁帘: "层搭装饰片",
    覆裙: "层搭装饰片",
    装饰片: "层搭装饰片",
    层搭装饰片: "层搭装饰片",
    layeringpanel: "层搭装饰片",
    overlaypanel: "层搭装饰片",
    hipscarf: "层搭装饰片",
    decorativepanel: "层搭装饰片",
    披肩: "披肩",
    scarf: "围巾",
    围巾: "围巾",
    hat: "帽子",
    帽子: "帽子",
    jewelry: "首饰",
    首饰: "首饰"
  };

  return mapping[normalized] ?? (category === "配饰" ? fallbackLabel(value) : undefined);
}

function normalizeDecorativeSubCategory(value?: string): string | undefined {
  return normalizeSubCategoryValue(value, "配饰");
}

function mapWithAliases(
  value: string,
  mapping: Record<string, string>
): string | undefined {
  const normalized = toLookupKey(value);
  return mapping[normalized] ?? fallbackLabel(value);
}

function fallbackLabel(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function toLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_\-\/\\,，、.。:：;；()（）\[\]{}'"]+/g, "");
}

const DECORATIVE_ACCESSORY_HINTS = new Set([
  "屁帘",
  "覆裙",
  "装饰片",
  "层搭装饰片",
  "layeringpanel",
  "overlaypanel",
  "decorativepanel",
  "waistaccessory",
  "beltaccessory",
  "腰饰",
  "腰链",
  "腰封",
  "hipscarf"
]);

export function createInMemoryClosetService(
  deps: Pick<ClosetServiceDependencies, "taskCenterService"> &
    Partial<
      Pick<
        ClosetServiceDependencies,
        "repository" | "llmGatewayService" | "taskRepository" | "userProfileRepository"
      >
    >
): ClosetService {
  return new InMemoryClosetService({
    repository: deps.repository ?? createInMemoryClosetRepository(),
    taskCenterService: deps.taskCenterService,
    llmGatewayService: deps.llmGatewayService,
    taskRepository: deps.taskRepository,
    userProfileRepository: deps.userProfileRepository
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

type AttributeRecognitionType = "clothes" | "jewelry";
type AttributeEngine = "auto" | "fashion_clip" | "clip" | "rules";

interface SkillCenterAttributeEntry {
  label?: string;
  nameCn?: string;
  confidence?: number;
  group?: string;
}

interface SkillCenterAttributeResult {
  engine?: string;
  recognitionType: AttributeRecognitionType;
  modelName?: string;
  category?: SkillCenterAttributeEntry;
  attributes: SkillCenterAttributeEntry[];
  colors?: string[];
}

async function requestClothesAttribute(input: {
  bytes: Buffer;
  contentType: string;
  filename: string;
  recognitionType: AttributeRecognitionType;
  engine?: AttributeEngine;
  topK?: number;
  attributeThreshold?: number;
}): Promise<SkillCenterAttributeResult> {
  const config = loadConfig();
  if (!config.skillCenter.baseUrl) {
    throw new AppError(
      "Clothes attribute service is not configured",
      "INVALID_REQUEST",
      400
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.skillCenter.timeoutMs);

  try {
    const formData = new FormData();
    formData.set(
      "file",
      new Blob([new Uint8Array(input.bytes)], { type: input.contentType }),
      input.filename
    );
    formData.set("recognition_type", input.recognitionType);
    formData.set("engine", input.engine ?? "fashion_clip");
    formData.set("top_k", String(input.topK ?? 3));
    formData.set(
      "attribute_threshold",
      String(input.attributeThreshold ?? 0.18)
    );

    const response = await fetch(
      `${config.skillCenter.baseUrl.replace(/\/$/, "")}/api/v1/clothes-attribute`,
      {
        method: "POST",
        body: formData,
        signal: controller.signal
      }
    );

    if (!response.ok) {
      const detail = await safeReadText(response);
      throw new AppError(
        `Clothes attribute request failed: ${detail || response.statusText}`,
        "INVALID_REQUEST",
        400
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    return {
      engine: asOptionalString(payload.engine),
      recognitionType:
        payload.recognition_type === "jewelry" ? "jewelry" : "clothes",
      modelName: asOptionalString(payload.model_name),
      category: normalizeSkillCenterEntry(payload.category),
      attributes: normalizeSkillCenterEntryList(payload.attributes),
      colors: asOptionalStringArray(payload.colors)
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError(
        "Clothes attribute request timed out",
        "INVALID_REQUEST",
        400
      );
    }
    throw new AppError(
      error instanceof Error ? error.message : "Clothes attribute failed",
      "INVALID_REQUEST",
      400
    );
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeSkillCenterEntry(value: unknown): SkillCenterAttributeEntry | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const entry = value as Record<string, unknown>;
  const label = asOptionalString(entry.label);
  const nameCn = asOptionalString(entry.name_cn);
  const group = asOptionalString(entry.group);
  const confidence =
    typeof entry.confidence === "number" ? entry.confidence : undefined;

  if (!label && !nameCn && !group && confidence === undefined) {
    return undefined;
  }

  return {
    label,
    nameCn,
    group,
    confidence
  };
}

function normalizeSkillCenterEntryList(value: unknown): SkillCenterAttributeEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => normalizeSkillCenterEntry(entry))
    .filter((entry): entry is SkillCenterAttributeEntry => Boolean(entry));
}

function normalizeSkillCenterAttributes(
  result: SkillCenterAttributeResult
): Partial<ClothingAttributes> {
  const category = normalizeSkillCenterCategory(result);
  const subCategory = normalizeSkillCenterSubCategory(result, category);
  const colors = normalizeArray(result.colors, normalizeColorValue);
  const material = normalizeSkillCenterAttributeValue(result, ["material"]);
  const pattern = normalizeSkillCenterAttributeValue(result, ["pattern"]);
  const fit = normalizeSkillCenterAttributeList(result, ["fit"], normalizeFitValue);
  const length = normalizeSkillCenterAttributeValue(result, ["length"]);
  const tags = normalizeSkillCenterTagList(result);
  const confidence = buildSkillCenterConfidence(result);

  return {
    category,
    subCategory,
    colors,
    material,
    pattern,
    fit,
    length,
    tags,
    confidence
  };
}

function normalizeSkillCenterCategory(
  result: SkillCenterAttributeResult
): string | undefined {
  if (result.recognitionType === "jewelry") {
    return "配饰";
  }

  const candidates = [
    result.category?.nameCn,
    result.category?.label
  ].filter((value): value is string => Boolean(value));

  for (const value of candidates) {
    const normalized = normalizeCategoryValue(value);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function normalizeSkillCenterSubCategory(
  result: SkillCenterAttributeResult,
  category?: string
): string | undefined {
  const rawName =
    result.category?.nameCn || result.category?.label || undefined;
  if (!rawName) {
    return undefined;
  }

  if (result.recognitionType === "jewelry" || category === "配饰") {
    return normalizeAccessorySubCategory(rawName);
  }

  return fallbackLabel(rawName);
}

function normalizeAccessorySubCategory(value: string): string | undefined {
  const key = toLookupKey(value);
  const mapping: Record<string, string> = {
    jewelry: "首饰",
    pendant: "吊坠",
    necklace: "项链",
    earrings: "耳环",
    earring: "耳环",
    ring: "戒指",
    bracelet: "手链",
    brooch: "胸针",
    anklet: "脚链",
    首饰: "首饰",
    吊坠: "吊坠",
    项链: "项链",
    耳环: "耳环",
    耳饰: "耳环",
    戒指: "戒指",
    手链: "手链",
    胸针: "胸针",
    脚链: "脚链"
  };

  return mapping[key] ?? fallbackLabel(value);
}

function normalizeSkillCenterAttributeValue(
  result: SkillCenterAttributeResult,
  groups: string[],
  mapper?: (value: string) => string | undefined
): string | undefined {
  const list = normalizeSkillCenterAttributeList(result, groups, mapper);
  return list?.[0];
}

function normalizeSkillCenterAttributeList(
  result: SkillCenterAttributeResult,
  groups: string[],
  mapper?: (value: string) => string | undefined
): string[] | undefined {
  const groupSet = new Set(groups.map((value) => toLookupKey(value)));
  const values = result.attributes
    .filter((entry) => groupSet.has(toLookupKey(entry.group || "")))
    .map((entry) => entry.nameCn || entry.label || "")
    .filter((value): value is string => Boolean(value));

  if (values.length === 0) {
    return undefined;
  }

  if (mapper) {
    return normalizeArray(values, mapper);
  }

  return normalizeArray(values, fallbackLabel);
}

function normalizeSkillCenterTagList(
  result: SkillCenterAttributeResult
): string[] | undefined {
  const skippedGroups = new Set(["material", "pattern", "fit", "length"]);
  const values = result.attributes
    .filter((entry) => !skippedGroups.has(toLookupKey(entry.group || "")))
    .map((entry) => entry.nameCn || entry.label || "")
    .filter((value): value is string => Boolean(value));

  return normalizeArray(values, normalizeTagLikeValue);
}

function normalizeTagLikeValue(value: string): string | undefined {
  return normalizeTagValue(value) ?? fallbackLabel(value);
}

function buildSkillCenterConfidence(
  result: SkillCenterAttributeResult
): Record<string, number> | undefined {
  const entries: Array<[string, number]> = [];
  if (typeof result.category?.confidence === "number") {
    entries.push(["category", result.category.confidence]);
  }

  result.attributes.forEach((entry, index) => {
    if (typeof entry.confidence !== "number") {
      return;
    }

    const name = entry.nameCn || entry.label || `attr-${index + 1}`;
    const group = entry.group ? toLookupKey(entry.group) : "attr";
    entries.push([`${group}:${name}`, entry.confidence]);
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

async function requestClothesCutout(input: {
  bytes: Buffer;
  contentType: string;
  filename: string;
  recognitionType: "clothes" | "jewelry";
  engine?: "auto" | "rembg" | "classic";
  keepCanvas?: boolean;
  saveMask?: boolean;
}): Promise<{
  outputBytes: Buffer;
  outputContentType: string;
  outputFilename: string;
  engineRequested: string;
  engineUsed: string;
  transparentBackground: boolean;
}> {
  const config = loadConfig();
  if (!config.skillCenter.baseUrl) {
    throw new AppError("Clothes cutout service is not configured", "INVALID_REQUEST", 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.skillCenter.timeoutMs);

  try {
    const formData = new FormData();
    formData.set(
      "file",
      new Blob([new Uint8Array(input.bytes)], { type: input.contentType }),
      input.filename
    );
    formData.set("recognition_type", input.recognitionType);
    if (input.recognitionType === "clothes") {
      formData.set("engine", input.engine ?? "auto");
    }
    formData.set("keep_canvas", String(Boolean(input.keepCanvas)));
    formData.set("save_mask", String(Boolean(input.saveMask)));

    const response = await fetch(
      `${config.skillCenter.baseUrl.replace(/\/$/, "")}/api/v1/clothes-cutout`,
      {
        method: "POST",
        body: formData,
        signal: controller.signal
      }
    );

    if (!response.ok) {
      const detail = await safeReadText(response);
      throw new AppError(
        `Clothes cutout request failed: ${detail || response.statusText}`,
        "INVALID_REQUEST",
        400
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const outputUrl = typeof payload.output_url === "string" ? payload.output_url : "";
    if (!outputUrl) {
      throw new AppError("Clothes cutout result did not include output_url", "INVALID_REQUEST", 400);
    }

    const fileResponse = await fetch(outputUrl, { signal: controller.signal });
    if (!fileResponse.ok) {
      throw new AppError("Failed to download cutout image", "INVALID_REQUEST", 400);
    }

    const arrayBuffer = await fileResponse.arrayBuffer();
    const outputBytes = Buffer.from(arrayBuffer);
      return {
        outputBytes,
        outputContentType: fileResponse.headers.get("content-type") || "image/png",
        outputFilename:
          (typeof payload.output_filename === "string" && payload.output_filename) ||
          replaceFileExtension(input.filename, ".png"),
        engineRequested:
          (typeof payload.engine_requested === "string" && payload.engine_requested) ||
          (input.recognitionType === "jewelry" ? "jewelry" : input.engine ?? "auto"),
        engineUsed:
          (typeof payload.engine_used === "string" && payload.engine_used) ||
          (input.recognitionType === "jewelry" ? "jewelry" : input.engine ?? "auto"),
        transparentBackground: payload.transparent_background !== false
      };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new AppError("Clothes cutout request timed out", "INVALID_REQUEST", 400);
    }
    throw new AppError(
      error instanceof Error ? error.message : "Clothes cutout failed",
      "INVALID_REQUEST",
      400
    );
  } finally {
    clearTimeout(timeout);
  }
}

function buildImageFilename(
  record: ClothingItemRecord,
  contentType: string
): string {
  const extension = inferFileExtension(contentType);
  return `${record.id}${extension}`;
}

function inferCutoutRecognitionType(
  record: Pick<ClothingItemRecord, "category" | "subCategory">
): "clothes" | "jewelry" | undefined {
  return inferRecognitionTypeFromCategoryText(record.category, record.subCategory);
}

function inferAttributeRecognitionType(
  record: Pick<ClothingItemRecord, "category" | "subCategory">
): "clothes" | "jewelry" | undefined {
  return inferRecognitionTypeFromCategoryText(record.category, record.subCategory);
}

function inferRecognitionTypeFromCategoryText(
  category?: string | null,
  subCategory?: string | null
): "clothes" | "jewelry" | undefined {
  const text = `${category ?? ""} ${subCategory ?? ""}`.trim();
  if (!text) {
    return undefined;
  }

  if (
    text.includes("配饰") ||
    text.includes("项链") ||
    text.includes("耳环") ||
    text.includes("耳饰") ||
    text.includes("戒指") ||
    text.includes("手链") ||
    text.includes("胸针") ||
    text.includes("首饰")
  ) {
    return "jewelry";
  }

  return "clothes";
}

function inferFileExtension(contentType: string): string {
  switch (contentType) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return ".jpg";
  }
}

function replaceFileExtension(filename: string, nextExtension: string): string {
  if (!filename) {
    return `cutout${nextExtension}`;
  }
  return filename.replace(/\.[a-zA-Z0-9]+$/, nextExtension);
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function isPersistableRemoteUrl(value?: string): value is string {
  return (
    !!value &&
    (value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("cloud://"))
  );
}

function resolveRecoverableImageUrl(value?: string): string | undefined {
  if (!value || typeof value !== "string") {
    return undefined;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return undefined;
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
