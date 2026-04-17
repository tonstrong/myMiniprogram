import { randomUUID } from "crypto";
import { AppError } from "../../../app/common/errors";
import type { SavedOutfitItemRecord, SavedOutfitRecord } from "../infrastructure";
import type {
  SaveSavedOutfitCommand,
  SaveSavedOutfitLayoutItem,
  SaveSavedOutfitResult,
  SavedOutfitHistoryItem,
  SavedOutfitListQuery,
  SavedOutfitService,
  SavedOutfitServiceDependencies
} from "./index";

const DEFAULT_PAGE_NO = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_LAYOUT_ITEMS = 8;

export class PersistedSavedOutfitService implements SavedOutfitService {
  constructor(private readonly deps: SavedOutfitServiceDependencies) {}

  async save(command: SaveSavedOutfitCommand): Promise<SaveSavedOutfitResult> {
    const normalizedLayoutItems = normalizeLayoutItems(command);
    const allItemIds = normalizedLayoutItems.map((item) => item.itemId);

    if (allItemIds.length === 0) {
      throw new AppError("At least one outfit item is required", "INVALID_REQUEST", 400);
    }
    if (allItemIds.length > MAX_LAYOUT_ITEMS) {
      throw new AppError(`At most ${MAX_LAYOUT_ITEMS} outfit items are allowed`, "INVALID_REQUEST", 400);
    }

    const uniqueItemIds = new Set(allItemIds);
    if (uniqueItemIds.size !== allItemIds.length) {
      throw new AppError("Duplicate outfit items are not allowed", "INVALID_REQUEST", 400);
    }

    await ensureItemsOwnedByUser(this.deps, command.userId, allItemIds);

    const now = new Date();
    const savedOutfitId = generateId();
    const outfitRecord: SavedOutfitRecord = {
      id: savedOutfitId,
      userId: command.userId,
      sourceType: command.sourceType,
      coverItemId: pickCoverItemId(normalizedLayoutItems),
      createdAt: now,
      updatedAt: now
    };
    const itemRecords = buildItemRecords(savedOutfitId, normalizedLayoutItems, now);

    await this.deps.repository.saveOutfit(outfitRecord, itemRecords);

    return {
      savedOutfitId,
      createdAt: now.toISOString()
    };
  }

  async list(userId: string, query: SavedOutfitListQuery) {
    const pageNo = query.pageNo ?? DEFAULT_PAGE_NO;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const result = await this.deps.repository.listByUser(userId, {
      pageNo,
      pageSize
    });

    const items = await Promise.all(
      result.items.map(async (item): Promise<SavedOutfitHistoryItem> => ({
        savedOutfitId: item.id,
        sourceType: item.sourceType,
        createdAt: item.createdAt.toISOString(),
        coverImageUrl: item.coverImageUrl ?? undefined,
        itemCount: item.itemCount,
        previewItems: await Promise.all(
          (item.previewItems || []).map((preview) =>
            this.resolvePreviewItem(preview.itemId, {
              slotCode: preview.slotCode,
              sortOrder: preview.sortOrder,
              imageUrl: preview.imageOriginalUrl ?? undefined,
              category: preview.category ?? undefined,
              subCategory: preview.subCategory ?? undefined,
              x: preview.layoutX ?? undefined,
              y: preview.layoutY ?? undefined,
              w: preview.layoutW ?? undefined,
              h: preview.layoutH ?? undefined,
              layerIndex: preview.layerIndex ?? undefined
            })
          )
        )
      }))
    );

    return {
      items,
      pageNo,
      pageSize,
      total: result.total
    };
  }

  async delete(userId: string, savedOutfitId: string): Promise<void> {
    const deleted = await this.deps.repository.deleteOutfit(userId, savedOutfitId);
    if (!deleted) {
      throw new AppError("Saved outfit not found", "NOT_FOUND", 404);
    }
  }

  private async resolvePreviewItem(
    itemId: string,
    fallback: {
      slotCode: string;
      sortOrder: number;
      imageUrl?: string;
      category?: string;
      subCategory?: string;
      x?: number;
      y?: number;
      w?: number;
      h?: number;
      layerIndex?: number;
    }
  ) {
    if (fallback.imageUrl && fallback.category) {
      return {
        itemId,
        slotCode: fallback.slotCode,
        sortOrder: fallback.sortOrder,
        imageUrl: fallback.imageUrl,
        category: fallback.category,
        subCategory: fallback.subCategory,
        x: fallback.x,
        y: fallback.y,
        w: fallback.w,
        h: fallback.h,
        layerIndex: fallback.layerIndex
      };
    }

    const item = await this.deps.closetRepository.findItemById(itemId);
    return {
      itemId,
      slotCode: fallback.slotCode,
      sortOrder: fallback.sortOrder,
              imageUrl: fallback.imageUrl || item?.imageOriginalUrl || undefined,
              category: fallback.category || item?.category || undefined,
              subCategory: fallback.subCategory || item?.subCategory || undefined,
              x: fallback.x,
              y: fallback.y,
              w: fallback.w,
              h: fallback.h,
              layerIndex: fallback.layerIndex
    };
  }
}

export function createSavedOutfitService(
  deps: SavedOutfitServiceDependencies
): SavedOutfitService {
  return new PersistedSavedOutfitService(deps);
}

function normalizeLayoutItems(command: SaveSavedOutfitCommand): Array<Required<SaveSavedOutfitLayoutItem>> {
  if (command.layoutItems?.length) {
    return command.layoutItems
      .filter((item) => !!item.itemId)
      .map((item, index) => ({
        itemId: item.itemId,
        slotCode: item.slotCode || "free",
        x: normalizeLayoutNumber(item.x, 0),
        y: normalizeLayoutNumber(item.y, 0),
        w: normalizeLayoutSize(item.w, 0.24),
        h: normalizeLayoutSize(item.h, 0.24),
        layerIndex: item.layerIndex ?? index
      }));
  }

  const slots = {
    top: command.slots?.top || undefined,
    bottom: command.slots?.bottom || undefined,
    dress: command.slots?.dress || undefined,
    outer: command.slots?.outer || undefined,
    shoes: command.slots?.shoes || undefined,
    bag: command.slots?.bag || undefined,
    accessories: (command.slots?.accessories || []).filter(Boolean)
  };

  return buildLegacyLayoutItems(slots);
}

async function ensureItemsOwnedByUser(
  deps: SavedOutfitServiceDependencies,
  userId: string,
  itemIds: string[]
) {
  for (const itemId of itemIds) {
    const item = await deps.closetRepository.findItemById(itemId);
    if (!item || item.userId !== userId || item.status !== "active") {
      throw new AppError("Only your active closet items can be saved to canvas", "INVALID_REQUEST", 400);
    }
  }
}

function buildItemRecords(
  savedOutfitId: string,
  layoutItems: Array<Required<SaveSavedOutfitLayoutItem>>,
  now: Date
): SavedOutfitItemRecord[] {
  return layoutItems.map((item, index) => ({
      id: generateId(),
      savedOutfitId,
      itemId: item.itemId,
      slotCode: item.slotCode,
      sortOrder: index,
      layoutX: item.x,
      layoutY: item.y,
      layoutW: item.w,
      layoutH: item.h,
      layerIndex: item.layerIndex,
      createdAt: now
    }));
}

function pickCoverItemId(layoutItems: Array<Required<SaveSavedOutfitLayoutItem>>) {
  if (layoutItems.length === 0) {
    return null;
  }
  const sorted = [...layoutItems].sort((a, b) => {
    const areaDiff = b.w * b.h - a.w * a.h;
    if (areaDiff !== 0) {
      return areaDiff;
    }
    return a.layerIndex - b.layerIndex;
  });
  return sorted[0]?.itemId || null;
}

function buildLegacyLayoutItems(slots: {
  top?: string;
  bottom?: string;
  dress?: string;
  outer?: string;
  shoes?: string;
  bag?: string;
  accessories: string[];
}): Array<Required<SaveSavedOutfitLayoutItem>> {
  const items: Array<Required<SaveSavedOutfitLayoutItem>> = [];
  const pushIfPresent = (
    itemId: string | undefined,
    slotCode: string,
    layout: Pick<Required<SaveSavedOutfitLayoutItem>, "x" | "y" | "w" | "h">
  ) => {
    if (!itemId) {
      return;
    }
    items.push({
      itemId,
      slotCode,
      layerIndex: items.length,
      ...layout
    });
  };

  pushIfPresent(slots.outer, "outer", { x: 0.04, y: 0.04, w: 0.3, h: 0.38 });
  pushIfPresent(slots.dress, "dress", { x: 0.34, y: 0.08, w: 0.34, h: 0.56 });
  pushIfPresent(slots.top, "top", { x: 0.34, y: 0.08, w: 0.34, h: 0.24 });
  pushIfPresent(slots.bottom, "bottom", { x: 0.34, y: 0.32, w: 0.3, h: 0.46 });
  pushIfPresent(slots.bag, "bag", { x: 0.06, y: 0.66, w: 0.18, h: 0.18 });
  pushIfPresent(slots.shoes, "shoes", { x: 0.34, y: 0.8, w: 0.28, h: 0.12 });

  slots.accessories.forEach((itemId, index) => {
    items.push({
      itemId,
      slotCode: "accessories",
      x: 0.8,
      y: Math.min(0.1 + index * 0.11, 0.76),
      w: 0.12,
      h: 0.12,
      layerIndex: items.length
    });
  });

  return items;
}

function normalizeLayoutNumber(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, value));
}

function normalizeLayoutSize(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }
  return Math.min(1, Math.max(0.05, value));
}

function generateId(): string {
  try {
    return randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
