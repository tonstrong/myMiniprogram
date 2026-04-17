import api from '../../utils/api';
import { resolveImageUrl } from '../../utils/image-url';

const DRAFT_KEY = 'outfit-canvas:draft';
const IMPORT_KEY = 'outfit-canvas:import';
const MAX_CANVAS_ITEMS = 15;
const MIN_CANVAS_ITEM_SIZE = 0.08;

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
    pickerVisible: false,
    maxCanvasItems: MAX_CANVAS_ITEMS,
    boardWidth: 0,
    boardHeight: 0,
    boardReady: false,
    resizingCanvasItemId: '',
    pinchingCanvasItemId: ''
  },

  onLoad() {
    this.pendingMoveMap = {};
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
    this.pendingMoveMap = {};
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

    this.pendingImportedSavedOutfitId = imported.savedOutfitId || '';

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

  persistDraft(
    nextCanvasItems = this.getNormalizedCanvasItems(),
    selectedCanvasItemId = this.data.selectedCanvasItemId
  ) {
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
      const closetItems = await Promise.all(
        (res.items || []).map(async (item) => ({
          id: item.itemId,
          category: item.category,
          subCategory: item.subCategory || '',
          title: [item.category, item.subCategory].filter(Boolean).join(' / ') || '未命名单品',
          imageUrl: await resolveImageUrl(item.imageOriginalUrl),
          addedToCanvas: false
        }))
      );
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
      const lastSavedOutfitId = this.pendingImportedSavedOutfitId || '';
      this.pendingImportLayoutItems = null;
      this.pendingImportedSavedOutfitId = '';
      this.syncCanvasItems(importedItems, importedItems[0]?.id || '');
      if (lastSavedOutfitId) {
        this.setData({ lastSavedOutfitId });
      }
      this.persistDraft(importedItems, importedItems[0]?.id || '');
      wx.showToast({ title: '已载入这套搭配', icon: 'success' });
      return;
    }

    if (this.pendingImportSlots) {
      const importedItems = buildCanvasItemsFromSlots(this.pendingImportSlots, this.data.closetItems);
      const lastSavedOutfitId = this.pendingImportedSavedOutfitId || '';
      this.pendingImportSlots = null;
      this.pendingImportedSavedOutfitId = '';
      this.syncCanvasItems(importedItems, importedItems[0]?.id || '');
      if (lastSavedOutfitId) {
        this.setData({ lastSavedOutfitId });
      }
      this.persistDraft(importedItems, importedItems[0]?.id || '');
      wx.showToast({ title: '已载入这套搭配', icon: 'success' });
    }
  },

  openClosetPicker() {
    this.setData({ pickerVisible: true });
  },

  closeClosetPicker() {
    this.setData({ pickerVisible: false });
  },

  noop() {},

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
      wx.showToast({ title: '这件单品已在画布中', icon: 'none' });
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
    this.selectCanvasItemById(e.currentTarget.dataset.id);
  },

  selectCanvasItemById(canvasId) {
    if (!canvasId) {
      return;
    }

    const nextItems = this.getNormalizedCanvasItems();
    this.syncCanvasItems(nextItems, canvasId);
    this.persistDraft(nextItems, canvasId);
  },

  onPieceMove(e) {
    if (!this.data.boardWidth || !this.data.boardHeight || this.pinchSession) {
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

    this.pendingMoveMap = {
      ...(this.pendingMoveMap || {}),
      [canvasId]: {
        x: nextX,
        y: nextY
      }
    };
  },

  onPieceTouchStart(e) {
    const touches = e.touches || [];
    if (touches.length < 2 || !this.data.boardWidth || !this.data.boardHeight || this.resizeSession) {
      return;
    }

    const canvasId = e.currentTarget.dataset.id;
    const currentItems = this.getNormalizedCanvasItems();
    const target = currentItems.find((item) => item.id === canvasId);
    if (!canvasId || !target) {
      return;
    }

    this.selectCanvasItemById(canvasId);
    this.pinchSession = {
      id: canvasId,
      startDistance: getTouchDistance(touches[0], touches[1]),
      startW: target.w,
      startH: target.h,
      centerX: target.x + target.w / 2,
      centerY: target.y + target.h / 2
    };
    this.setData({ pinchingCanvasItemId: canvasId });
  },

  onPieceTouchMove(e) {
    const touches = e.touches || [];
    const session = this.pinchSession;
    if (!session || touches.length < 2 || !this.data.boardWidth || !this.data.boardHeight || this.resizeSession) {
      return;
    }

    const currentDistance = getTouchDistance(touches[0], touches[1]);
    if (!currentDistance || !session.startDistance) {
      return;
    }

    const scaleRatio = currentDistance / session.startDistance;
    const currentItems = this.getNormalizedCanvasItems();
    const targetIndex = currentItems.findIndex((item) => item.id === session.id);
    if (targetIndex < 0) {
      return;
    }

    const nextW = clampSize(session.startW * scaleRatio, session.startW);
    const nextH = clampSize(session.startH * scaleRatio, session.startH);
    const safeW = clamp(nextW, MIN_CANVAS_ITEM_SIZE, 1);
    const safeH = clamp(nextH, MIN_CANVAS_ITEM_SIZE, 1);
    const nextX = clampPosition(session.centerX - safeW / 2, safeW);
    const nextY = clampPosition(session.centerY - safeH / 2, safeH);

    currentItems[targetIndex] = {
      ...currentItems[targetIndex],
      x: nextX,
      y: nextY,
      w: safeW,
      h: safeH
    };
    this.syncCanvasItems(currentItems, session.id);
  },

  onPieceTouchEnd(e) {
    this.commitPendingMove(e.currentTarget.dataset.id);

    if (!this.pinchSession) {
      return;
    }

    if ((e.touches || []).length >= 2) {
      return;
    }

    const selectedCanvasItemId = this.pinchSession.id;
    this.pinchSession = null;
    this.setData({ pinchingCanvasItemId: '' });
    this.persistDraft(this.getNormalizedCanvasItems(), selectedCanvasItemId);
  },

  startResize(e) {
    if (!this.data.boardWidth || !this.data.boardHeight) {
      return;
    }

    this.pinchSession = null;
    this.setData({ pinchingCanvasItemId: '' });

    const canvasId = e.currentTarget.dataset.id;
    const touch = e.touches?.[0];
    const target = this.getNormalizedCanvasItems().find((item) => item.id === canvasId);
    if (!canvasId || !touch || !target) {
      return;
    }

    this.selectCanvasItemById(canvasId);
    this.resizeSession = {
      id: canvasId,
      startClientX: touch.clientX,
      startClientY: touch.clientY,
      startW: target.w,
      startH: target.h,
      startX: target.x,
      startY: target.y,
      aspectRatio: target.h > 0 ? target.w / target.h : 1
    };
    this.setData({ resizingCanvasItemId: canvasId });
  },

  onResizeMove(e) {
    const session = this.resizeSession;
    const touch = e.touches?.[0];
    if (!session || !touch || !this.data.boardWidth || !this.data.boardHeight) {
      return;
    }

    const currentItems = this.getNormalizedCanvasItems();
    const targetIndex = currentItems.findIndex((item) => item.id === session.id);
    if (targetIndex < 0) {
      return;
    }

    const deltaX = (touch.clientX - session.startClientX) / this.data.boardWidth;
    const deltaY = (touch.clientY - session.startClientY) / this.data.boardHeight;
    const delta = (deltaX + deltaY) / 2;
    const aspectRatio = Math.max(session.aspectRatio, 0.2);

    let nextW = clampSize(session.startW + delta, session.startW);
    let nextH = clampSize(nextW / aspectRatio, session.startH);

    const maxW = Math.max(1 - session.startX, MIN_CANVAS_ITEM_SIZE);
    const maxH = Math.max(1 - session.startY, MIN_CANVAS_ITEM_SIZE);

    if (nextW > maxW) {
      nextW = maxW;
      nextH = nextW / aspectRatio;
    }
    if (nextH > maxH) {
      nextH = maxH;
      nextW = nextH * aspectRatio;
    }

    currentItems[targetIndex] = {
      ...currentItems[targetIndex],
      w: clamp(nextW, MIN_CANVAS_ITEM_SIZE, maxW),
      h: clamp(nextH, MIN_CANVAS_ITEM_SIZE, maxH)
    };
    this.syncCanvasItems(currentItems, session.id);
  },

  endResize() {
    if (!this.resizeSession) {
      return;
    }

    const selectedCanvasItemId = this.resizeSession.id;
    this.resizeSession = null;
    this.setData({ resizingCanvasItemId: '' });
    this.persistDraft(this.getNormalizedCanvasItems(), selectedCanvasItemId);
  },

  commitPendingMove(canvasId) {
    if (!canvasId || !this.pendingMoveMap?.[canvasId]) {
      return;
    }

    const currentItems = this.getNormalizedCanvasItems();
    const targetIndex = currentItems.findIndex((item) => item.id === canvasId);
    if (targetIndex < 0) {
      delete this.pendingMoveMap[canvasId];
      return;
    }

    const nextPosition = this.pendingMoveMap[canvasId];
    currentItems[targetIndex] = {
      ...currentItems[targetIndex],
      x: nextPosition.x,
      y: nextPosition.y
    };
    delete this.pendingMoveMap[canvasId];
    this.syncCanvasItems(currentItems, this.data.selectedCanvasItemId || canvasId);
    this.persistDraft(currentItems, this.data.selectedCanvasItemId || canvasId);
  },

  bringSelectedToFront() {
    this.updateSelectedLayer((items, selectedCanvasItemId) =>
      moveCanvasItemToIndex(items, selectedCanvasItemId, items.length - 1)
    );
  },

  bringSelectedForward() {
    this.updateSelectedLayer((items, selectedCanvasItemId) =>
      moveCanvasItemByOffset(items, selectedCanvasItemId, 1)
    );
  },

  sendSelectedBackward() {
    this.updateSelectedLayer((items, selectedCanvasItemId) =>
      moveCanvasItemByOffset(items, selectedCanvasItemId, -1)
    );
  },

  sendSelectedToBack() {
    this.updateSelectedLayer((items, selectedCanvasItemId) =>
      moveCanvasItemToIndex(items, selectedCanvasItemId, 0)
    );
  },

  updateSelectedLayer(transformer) {
    const selectedCanvasItemId = this.data.selectedCanvasItemId;
    if (!selectedCanvasItemId) {
      wx.showToast({ title: '请先选中一个单品', icon: 'none' });
      return;
    }

    const nextItems = transformer(this.getNormalizedCanvasItems(), selectedCanvasItemId);
    this.syncCanvasItems(nextItems, selectedCanvasItemId);
    this.persistDraft(nextItems, selectedCanvasItemId);
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
    this.setData({ lastSavedOutfitId: '' });
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
      await api.request({
        url: '/api/saved-outfits',
        method: 'POST',
        data: {
          sourceType: 'canvas',
          savedOutfitId: this.data.lastSavedOutfitId || undefined,
          layoutItems
        }
      });

      wx.removeStorageSync(DRAFT_KEY);
      wx.removeStorageSync(IMPORT_KEY);
      this.syncCanvasItems([], '');
      this.setData({
        savingRemote: false,
        lastSavedOutfitId: ''
      });
      wx.showToast({ title: '已保存并返回首页', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/home/index' });
      }, 500);
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
    const normalizedItems = normalizeLayerIndexes(items);
    const decoratedItems = decorateCanvasItems(normalizedItems, this.data.boardWidth, this.data.boardHeight);
    const selectedItem =
      decoratedItems.find((item) => item.id === selectedCanvasItemId) ||
      decoratedItems[decoratedItems.length - 1] ||
      null;

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
  return (items || []).slice(0, MAX_CANVAS_ITEMS).map((item, index) => {
    const w = clampSize(Number(item.w), 0.24);
    const h = clampSize(Number(item.h), 0.24);
    return {
      id: item.id || `canvas-${item.itemId}-${index}`,
      itemId: item.itemId,
      category: item.category || '',
      subCategory: item.subCategory || '',
      title: item.title || [item.category, item.subCategory].filter(Boolean).join(' / ') || '未命名单品',
      imageUrl: item.imageUrl || '',
      x: clampPosition(Number(item.x), w),
      y: clampPosition(Number(item.y), h),
      w,
      h,
      layerIndex: Number.isFinite(item.layerIndex) ? Number(item.layerIndex) : index
    };
  });
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
    x: clampPosition(0.36 - size.w / 2 + offset, size.w),
    y: clampPosition(0.22 + offset, size.h),
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

    const fallbackSize = getDefaultCanvasSize(closetItem.category);
    const width = clampSize(Number(layoutItem.w), fallbackSize.w);
    const height = clampSize(Number(layoutItem.h), fallbackSize.h);

    return {
      id: `canvas-${layoutItem.itemId}-${index}`,
      itemId: layoutItem.itemId,
      category: closetItem.category,
      subCategory: closetItem.subCategory || '',
      title: closetItem.title,
      imageUrl: closetItem.imageUrl || '',
      x: clampPosition(Number(layoutItem.x), width),
      y: clampPosition(Number(layoutItem.y), height),
      w: width,
      h: height,
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
    case '鞋靴':
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
    case '鞋靴':
      return 'shoes';
    case '包袋':
      return 'bag';
    case '配饰':
      return 'accessories';
    default:
      return 'free';
  }
}

function normalizeLayerIndexes(items) {
  return sanitizeCanvasItems(items)
    .sort((a, b) => a.layerIndex - b.layerIndex)
    .map((item, index) => ({
      ...item,
      layerIndex: index
    }));
}

function moveCanvasItemByOffset(items, canvasId, offset) {
  const orderedItems = normalizeLayerIndexes(items);
  const currentIndex = orderedItems.findIndex((item) => item.id === canvasId);
  if (currentIndex < 0) {
    return orderedItems;
  }
  return moveCanvasItemToIndex(orderedItems, canvasId, currentIndex + offset);
}

function moveCanvasItemToIndex(items, canvasId, nextIndex) {
  const orderedItems = normalizeLayerIndexes(items);
  const currentIndex = orderedItems.findIndex((item) => item.id === canvasId);
  if (currentIndex < 0) {
    return orderedItems;
  }

  const targetIndex = clamp(Math.round(nextIndex), 0, Math.max(orderedItems.length - 1, 0));
  if (currentIndex === targetIndex) {
    return orderedItems;
  }

  const nextItems = [...orderedItems];
  const [targetItem] = nextItems.splice(currentIndex, 1);
  nextItems.splice(targetIndex, 0, targetItem);
  return nextItems.map((item, index) => ({
    ...item,
    layerIndex: index
  }));
}

function getTouchDistance(firstTouch, secondTouch) {
  if (!firstTouch || !secondTouch) {
    return 0;
  }

  const deltaX = firstTouch.clientX - secondTouch.clientX;
  const deltaY = firstTouch.clientY - secondTouch.clientY;
  return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
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
  return Math.min(0.8, Math.max(MIN_CANVAS_ITEM_SIZE, value));
}

function clampPosition(value, size) {
  return clamp(value, 0, Math.max(1 - size, 0));
}

function roundLayoutValue(value) {
  return Number(clamp(value, 0, 1).toFixed(4));
}
