import api from '../../utils/api';
import { resolveImageUrl } from '../../utils/image-url';

const DRAFT_KEY = 'outfit-canvas:draft';
const IMPORT_KEY = 'outfit-canvas:import';
const MAX_CANVAS_ITEMS = 8;

Page({
  data: {
    canvasItems: [],
    canvasItemIds: [],
    selectedCanvasItemId: '',
    selectedCanvasTitle: '',
    closetItems: [],
    loading: false,
    savingRemote: false,
    lastSavedOutfitId: '',
    maxCanvasItems: MAX_CANVAS_ITEMS,
    boardWidth: 0,
    boardHeight: 0,
    boardReady: false
  },

  onLoad() {
    if (!this.restoreImportedOutfit()) {
      this.restoreDraft();
    }
  },

  onReady() {
    this.measureBoard();
  },

  onShow() {
    this.measureBoard();
    this.fetchClosetItems();
  },

  restoreDraft() {
    const draft = wx.getStorageSync(DRAFT_KEY);
    if (!draft || typeof draft !== 'object') {
      return;
    }

    if (Array.isArray(draft.canvasItems)) {
      this.pendingCanvasItems = draft.canvasItems;
      this.pendingSelectedCanvasItemId = draft.selectedCanvasItemId || '';
      this.tryHydratePendingState();
      return;
    }

    if (draft.slots) {
      this.pendingImportSlots = draft.slots;
    }
  },

  restoreImportedOutfit() {
    const imported = wx.getStorageSync(IMPORT_KEY);
    if (!imported || typeof imported !== 'object') {
      return false;
    }

    if (Array.isArray(imported.layoutItems)) {
      this.pendingImportLayoutItems = imported.layoutItems;
    } else if (imported.slots) {
      this.pendingImportSlots = imported.slots;
    } else {
      return false;
    }

    wx.removeStorageSync(IMPORT_KEY);
    return true;
  },

  persistDraft(nextCanvasItems = this.getNormalizedCanvasItems(), selectedCanvasItemId = this.data.selectedCanvasItemId) {
    wx.setStorageSync(DRAFT_KEY, {
      canvasItems: nextCanvasItems,
      selectedCanvasItemId,
      updatedAt: Date.now()
    });
  },

  async fetchClosetItems() {
    this.setData({ loading: true });
    try {
      const res = await api.request({
        url: '/api/closet/items?status=active&pageNo=1&pageSize=100',
        method: 'GET'
      });
      const closetItems = await Promise.all((res.items || []).map(async (item) => ({
        id: item.itemId,
        category: item.category,
        subCategory: item.subCategory || '',
        title: [item.category, item.subCategory].filter(Boolean).join(' / ') || '未命名单品',
        imageUrl: await resolveImageUrl(item.imageOriginalUrl),
        addedToCanvas: false
      })));
      this.setData({ closetItems, loading: false });
      this.tryHydratePendingState();
    } catch (error) {
      console.error('Fetch canvas closet items failed', error);
      this.setData({ loading: false });
      wx.showToast({ title: '加载衣橱失败', icon: 'none' });
    }
  },

  measureBoard() {
    const query = wx.createSelectorQuery();
    query.select('#free-canvas-stage').boundingClientRect((rect) => {
      if (!rect || !rect.width || !rect.height) {
        return;
      }
      this.setData({
        boardWidth: rect.width,
        boardHeight: rect.height,
        boardReady: true
      });

      if (this.data.canvasItems.length > 0) {
        this.syncCanvasItems(this.getNormalizedCanvasItems(), this.data.selectedCanvasItemId);
      } else {
        this.tryHydratePendingState();
      }
    }).exec();
  },

  tryHydratePendingState() {
    if (!this.data.boardReady) {
      return;
    }

    if (this.pendingCanvasItems) {
      const canvasItems = sanitizeCanvasItems(this.pendingCanvasItems);
      const selectedCanvasItemId = this.pendingSelectedCanvasItemId || canvasItems[0]?.id || '';
      this.pendingCanvasItems = null;
      this.pendingSelectedCanvasItemId = '';
      this.syncCanvasItems(canvasItems, selectedCanvasItemId);
      return;
    }

    if (!this.data.closetItems.length) {
      return;
    }

    if (this.pendingImportLayoutItems) {
      const importedItems = buildCanvasItemsFromLayout(this.pendingImportLayoutItems, this.data.closetItems);
      this.pendingImportLayoutItems = null;
      this.syncCanvasItems(importedItems, importedItems[0]?.id || '');
      this.persistDraft(importedItems, importedItems[0]?.id || '');
      wx.showToast({ title: '已载入这套搭配', icon: 'success' });
      return;
    }

    if (this.pendingImportSlots) {
      const importedItems = buildCanvasItemsFromSlots(this.pendingImportSlots, this.data.closetItems);
      this.pendingImportSlots = null;
      this.syncCanvasItems(importedItems, importedItems[0]?.id || '');
      this.persistDraft(importedItems, importedItems[0]?.id || '');
      wx.showToast({ title: '已载入这套搭配', icon: 'success' });
    }
  },

  addClosetItem(e) {
    const itemId = e.currentTarget.dataset.id;
    const closetItem = this.data.closetItems.find((item) => item.id === itemId);
    if (!closetItem) {
      return;
    }

    if (this.data.canvasItemIds.includes(itemId)) {
      const existing = this.data.canvasItems.find((item) => item.itemId === itemId);
      if (existing) {
        this.selectCanvasItemById(existing.id);
      }
      wx.showToast({ title: '这件单品已在画布里', icon: 'none' });
      return;
    }

    if (this.data.canvasItems.length >= MAX_CANVAS_ITEMS) {
      wx.showToast({ title: `最多添加 ${MAX_CANVAS_ITEMS} 件`, icon: 'none' });
      return;
    }

    const nextItems = [
      ...this.getNormalizedCanvasItems(),
      buildCanvasItemFromCloset(closetItem, this.data.canvasItems.length)
    ];
    const newItemId = nextItems[nextItems.length - 1]?.id || '';
    this.syncCanvasItems(nextItems, newItemId);
    this.persistDraft(nextItems, newItemId);
  },

  selectCanvasItem(e) {
    const canvasId = e.currentTarget.dataset.id;
    this.selectCanvasItemById(canvasId);
  },

  selectCanvasItemById(canvasId) {
    if (!canvasId) {
      return;
    }
    const nextItems = bringCanvasItemToFront(this.getNormalizedCanvasItems(), canvasId);
    this.syncCanvasItems(nextItems, canvasId);
    this.persistDraft(nextItems, canvasId);
  },

  onPieceMove(e) {
    if (!this.data.boardWidth || !this.data.boardHeight) {
      return;
    }

    const canvasId = e.currentTarget.dataset.id;
    const currentItems = this.getNormalizedCanvasItems();
    const targetIndex = currentItems.findIndex((item) => item.id === canvasId);
    if (targetIndex < 0) {
      return;
    }

    const target = currentItems[targetIndex];
    const maxX = Math.max(this.data.boardWidth - target.w * this.data.boardWidth, 0);
    const maxY = Math.max(this.data.boardHeight - target.h * this.data.boardHeight, 0);
    const nextX = clamp((e.detail.x || 0) / this.data.boardWidth, 0, maxX / this.data.boardWidth);
    const nextY = clamp((e.detail.y || 0) / this.data.boardHeight, 0, maxY / this.data.boardHeight);

    currentItems[targetIndex] = {
      ...target,
      x: nextX,
      y: nextY
    };
    this.syncCanvasItems(currentItems, canvasId);
    this.persistDraft(currentItems, canvasId);
  },

  removeSelectedItem() {
    const selectedCanvasItemId = this.data.selectedCanvasItemId;
    if (!selectedCanvasItemId) {
      wx.showToast({ title: '请先选中一个单品', icon: 'none' });
      return;
    }

    const nextItems = this.getNormalizedCanvasItems().filter((item) => item.id !== selectedCanvasItemId);
    const nextSelectedId = nextItems[nextItems.length - 1]?.id || '';
    this.syncCanvasItems(nextItems, nextSelectedId);
    this.persistDraft(nextItems, nextSelectedId);
  },

  clearCanvas() {
    this.syncCanvasItems([], '');
    this.persistDraft([], '');
    wx.showToast({ title: '已清空画布', icon: 'success' });
  },

  saveCanvasDraft() {
    this.persistDraft();
    wx.showToast({ title: '搭配草稿已保存', icon: 'success' });
  },

  async saveCanvasRecord() {
    const layoutItems = this.getNormalizedCanvasItems()
      .sort((a, b) => a.layerIndex - b.layerIndex)
      .map((item) => ({
        itemId: item.itemId,
        slotCode: inferSlotFromCategory(item.category),
        x: roundLayoutValue(item.x),
        y: roundLayoutValue(item.y),
        w: roundLayoutValue(item.w),
        h: roundLayoutValue(item.h),
        layerIndex: item.layerIndex
      }));

    if (layoutItems.length === 0) {
      wx.showToast({ title: '请先加入至少一件单品', icon: 'none' });
      return;
    }

    this.setData({ savingRemote: true });
    try {
      const result = await api.request({
        url: '/api/saved-outfits',
        method: 'POST',
        data: {
          sourceType: 'canvas',
          layoutItems
        }
      });

      this.persistDraft();
      this.setData({
        savingRemote: false,
        lastSavedOutfitId: result.savedOutfitId
      });
      wx.showToast({ title: '正式搭配已保存', icon: 'success' });
    } catch (error) {
      console.error('Save outfit canvas record failed', error);
      this.setData({ savingRemote: false });
      wx.showToast({ title: '保存正式搭配失败', icon: 'none' });
    }
  },

  openSavedOutfits() {
    wx.navigateTo({ url: '/pages/saved-outfits/index' });
  },

  getNormalizedCanvasItems() {
    return (this.data.canvasItems || []).map(stripCanvasMetrics);
  },

  syncCanvasItems(items, selectedCanvasItemId = '') {
    const decoratedItems = decorateCanvasItems(items, this.data.boardWidth, this.data.boardHeight);
    const selectedItem = decoratedItems.find((item) => item.id === selectedCanvasItemId) || decoratedItems[decoratedItems.length - 1] || null;
    this.setData({
      canvasItems: decoratedItems,
      canvasItemIds: decoratedItems.map((item) => item.itemId),
      selectedCanvasItemId: selectedItem?.id || '',
      selectedCanvasTitle: selectedItem?.title || '',
      closetItems: (this.data.closetItems || []).map((item) => ({
        ...item,
        addedToCanvas: decoratedItems.some((canvasItem) => canvasItem.itemId === item.id)
      }))
    });
  }
});

function decorateCanvasItems(items, boardWidth, boardHeight) {
  return sanitizeCanvasItems(items).map((item) => ({
    ...item,
    xPx: Math.round(item.x * boardWidth),
    yPx: Math.round(item.y * boardHeight),
    widthPx: Math.max(Math.round(item.w * boardWidth), 56),
    heightPx: Math.max(Math.round(item.h * boardHeight), 56)
  }));
}

function sanitizeCanvasItems(items) {
  return (items || []).slice(0, MAX_CANVAS_ITEMS).map((item, index) => ({
    id: item.id || `canvas-${item.itemId}-${index}`,
    itemId: item.itemId,
    category: item.category || '',
    subCategory: item.subCategory || '',
    title: item.title || [item.category, item.subCategory].filter(Boolean).join(' / ') || '未命名单品',
    imageUrl: item.imageUrl || '',
    x: clamp(Number(item.x), 0, 0.88),
    y: clamp(Number(item.y), 0, 0.88),
    w: clampSize(Number(item.w), 0.24),
    h: clampSize(Number(item.h), 0.24),
    layerIndex: Number.isFinite(item.layerIndex) ? Number(item.layerIndex) : index
  }));
}

function buildCanvasItemFromCloset(item, index) {
  const size = getDefaultCanvasSize(item.category);
  const offset = Math.min(index * 0.03, 0.18);
  return {
    id: `canvas-${item.id}-${Date.now()}`,
    itemId: item.id,
    category: item.category,
    subCategory: item.subCategory || '',
    title: item.title,
    imageUrl: item.imageUrl || '',
    x: clamp(0.36 - size.w / 2 + offset, 0, 1 - size.w),
    y: clamp(0.22 + offset, 0, 1 - size.h),
    w: size.w,
    h: size.h,
    layerIndex: index
  };
}

function buildCanvasItemsFromLayout(layoutItems, closetItems) {
  const closetMap = new Map((closetItems || []).map((item) => [item.id, item]));
  return (layoutItems || []).map((layoutItem, index) => {
    const closetItem = closetMap.get(layoutItem.itemId);
    if (!closetItem) {
      return null;
    }
    return {
      id: `canvas-${layoutItem.itemId}-${index}`,
      itemId: layoutItem.itemId,
      category: closetItem.category,
      subCategory: closetItem.subCategory || '',
      title: closetItem.title,
      imageUrl: closetItem.imageUrl || '',
      x: clamp(Number(layoutItem.x), 0, 0.95),
      y: clamp(Number(layoutItem.y), 0, 0.95),
      w: clampSize(Number(layoutItem.w), getDefaultCanvasSize(closetItem.category).w),
      h: clampSize(Number(layoutItem.h), getDefaultCanvasSize(closetItem.category).h),
      layerIndex: Number.isFinite(layoutItem.layerIndex) ? Number(layoutItem.layerIndex) : index
    };
  }).filter(Boolean);
}

function buildCanvasItemsFromSlots(slots, closetItems) {
  const closetMap = new Map((closetItems || []).map((item) => [item.id, item]));
  const legacyLayout = [
    { key: 'outer', x: 0.04, y: 0.04, w: 0.3, h: 0.38 },
    { key: 'dress', x: 0.34, y: 0.08, w: 0.34, h: 0.56 },
    { key: 'top', x: 0.34, y: 0.08, w: 0.34, h: 0.24 },
    { key: 'bottom', x: 0.34, y: 0.32, w: 0.3, h: 0.46 },
    { key: 'bag', x: 0.06, y: 0.66, w: 0.18, h: 0.18 },
    { key: 'shoes', x: 0.34, y: 0.8, w: 0.28, h: 0.12 }
  ];

  const items = legacyLayout.map((layout, index) => {
    const itemId = slots?.[layout.key];
    if (!itemId) {
      return null;
    }
    const closetItem = closetMap.get(itemId);
    if (!closetItem) {
      return null;
    }
    return {
      id: `canvas-${itemId}-${layout.key}`,
      itemId,
      category: closetItem.category,
      subCategory: closetItem.subCategory || '',
      title: closetItem.title,
      imageUrl: closetItem.imageUrl || '',
      x: layout.x,
      y: layout.y,
      w: layout.w,
      h: layout.h,
      layerIndex: index
    };
  }).filter(Boolean);

  (slots?.accessories || []).forEach((itemId, index) => {
    const closetItem = closetMap.get(itemId);
    if (!closetItem) {
      return;
    }
    items.push({
      id: `canvas-${itemId}-accessories-${index}`,
      itemId,
      category: closetItem.category,
      subCategory: closetItem.subCategory || '',
      title: closetItem.title,
      imageUrl: closetItem.imageUrl || '',
      x: 0.8,
      y: Math.min(0.08 + index * 0.12, 0.78),
      w: 0.12,
      h: 0.12,
      layerIndex: items.length
    });
  });

  return items;
}

function bringCanvasItemToFront(items, canvasId) {
  const maxLayerIndex = items.reduce((maxValue, item) => Math.max(maxValue, item.layerIndex || 0), 0);
  return items.map((item) => item.id === canvasId ? { ...item, layerIndex: maxLayerIndex + 1 } : item);
}

function stripCanvasMetrics(item) {
  return {
    id: item.id,
    itemId: item.itemId,
    category: item.category,
    subCategory: item.subCategory,
    title: item.title,
    imageUrl: item.imageUrl,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    layerIndex: item.layerIndex
  };
}

function getDefaultCanvasSize(category) {
  switch (category) {
    case '连衣裙':
      return { w: 0.34, h: 0.5 };
    case '外套':
      return { w: 0.32, h: 0.38 };
    case '上衣':
      return { w: 0.3, h: 0.22 };
    case '下装':
      return { w: 0.28, h: 0.4 };
    case '鞋履':
      return { w: 0.22, h: 0.12 };
    case '包袋':
      return { w: 0.18, h: 0.18 };
    case '配饰':
      return { w: 0.12, h: 0.12 };
    default:
      return { w: 0.24, h: 0.24 };
  }
}

function inferSlotFromCategory(category) {
  switch (category) {
    case '上衣':
      return 'top';
    case '下装':
      return 'bottom';
    case '连衣裙':
      return 'dress';
    case '外套':
      return 'outer';
    case '鞋履':
      return 'shoes';
    case '包袋':
      return 'bag';
    case '配饰':
      return 'accessories';
    default:
      return 'free';
  }
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function clampSize(value, fallback) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(0.8, Math.max(0.08, value));
}

function roundLayoutValue(value) {
  return Number(clamp(value, 0, 1).toFixed(4));
}
