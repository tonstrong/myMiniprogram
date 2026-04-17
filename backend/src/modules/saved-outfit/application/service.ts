import { randomUUID } from "crypto";
import { AppError } from "../../../app/common/errors";
import type { SavedOutfitItemRecord, SavedOutfitRecord } from "../infrastructure";
import type {
  SaveSavedOutfitCommand,
  SaveSavedOutfitResult,
  SavedOutfitHistoryItem,
  SavedOutfitListQuery,
  SavedOutfitService,
  SavedOutfitServiceDependencies
} from "./index";

const DEFAULT_PAGE_NO = 1;
const DEFAULT_PAGE_SIZE = 20;

export class PersistedSavedOutfitService implements SavedOutfitService {
  constructor(private readonly deps: SavedOutfitServiceDependencies) {}

  async save(command: SaveSavedOutfitCommand): Promise<SaveSavedOutfitResult> {
    const normalizedSlots = normalizeSlots(command.slots);
    const allItemIds = collectItemIds(normalizedSlots);

    if (allItemIds.length === 0) {
      throw new AppError("At least one outfit item is required", "INVALID_REQUEST", 400);
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
      coverItemId: pickCoverItemId(normalizedSlots),
      createdAt: now,
      updatedAt: now
    };
    const itemRecords = buildItemRecords(savedOutfitId, normalizedSlots, now);

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
              subCategory: preview.subCategory ?? undefined
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
    }
  ) {
    if (fallback.imageUrl && fallback.category) {
      return {
        itemId,
        slotCode: fallback.slotCode,
        sortOrder: fallback.sortOrder,
        imageUrl: fallback.imageUrl,
        category: fallback.category,
        subCategory: fallback.subCategory
      };
    }

    const item = await this.deps.closetRepository.findItemById(itemId);
    return {
      itemId,
      slotCode: fallback.slotCode,
      sortOrder: fallback.sortOrder,
      imageUrl: fallback.imageUrl || item?.imageOriginalUrl || undefined,
      category: fallback.category || item?.category || undefined,
      subCategory: fallback.subCategory || item?.subCategory || undefined
    };
  }
}

export function createSavedOutfitService(
  deps: SavedOutfitServiceDependencies
): SavedOutfitService {
  return new PersistedSavedOutfitService(deps);
}

function normalizeSlots(slots: SaveSavedOutfitCommand["slots"]) {
  return {
    top: slots.top || undefined,
    bottom: slots.bottom || undefined,
    dress: slots.dress || undefined,
    outer: slots.outer || undefined,
    shoes: slots.shoes || undefined,
    bag: slots.bag || undefined,
    accessories: (slots.accessories || []).filter(Boolean)
  };
}

function collectItemIds(slots: ReturnType<typeof normalizeSlots>) {
  return [
    slots.top,
    slots.bottom,
    slots.dress,
    slots.outer,
    slots.shoes,
    slots.bag,
    ...slots.accessories
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
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

function pickCoverItemId(slots: ReturnType<typeof normalizeSlots>) {
  return slots.top || slots.dress || slots.bottom || slots.outer || slots.shoes || slots.bag || slots.accessories[0] || null;
}

function buildItemRecords(
  savedOutfitId: string,
  slots: ReturnType<typeof normalizeSlots>,
  now: Date
): SavedOutfitItemRecord[] {
  const items: SavedOutfitItemRecord[] = [];
  const singleSlots: Array<[string, string | undefined]> = [
    ["top", slots.top],
    ["bottom", slots.bottom],
    ["dress", slots.dress],
    ["outer", slots.outer],
    ["shoes", slots.shoes],
    ["bag", slots.bag]
  ];

  singleSlots.forEach(([slotCode, itemId]) => {
    if (!itemId) {
      return;
    }
    items.push({
      id: generateId(),
      savedOutfitId,
      itemId,
      slotCode,
      sortOrder: 0,
      createdAt: now
    });
  });

  slots.accessories.forEach((itemId, index) => {
    items.push({
      id: generateId(),
      savedOutfitId,
      itemId,
      slotCode: "accessories",
      sortOrder: index,
      createdAt: now
    });
  });

  return items;
}

function generateId(): string {
  try {
    return randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
