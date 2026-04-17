import api from '../../utils/api';
import { resolveImageUrl } from '../../utils/image-url';

const DRAFT_KEY = 'outfit-canvas:draft';
const IMPORT_KEY = 'outfit-canvas:import';
const SLOT_ORDER = ['top', 'bottom', 'dress', 'outer', 'shoes', 'bag', 'accessories'];
const SLOT_META = {
  top: { title: '上衣位', accept: ['上衣'] },
  bottom: { title: '下装位', accept: ['下装'] },
  dress: { title: '连衣裙位', accept: ['连衣裙'] },
  outer: { title: '外套位', accept: ['外套'] },
  shoes: { title: '鞋履位', accept: ['鞋履'] },
  bag: { title: '包袋位', accept: ['包袋'] },
  accessories: { title: '配饰位', accept: ['配饰'] }
};

Page({
  data: {
    activeSlot: 'top',
    activeSlotTitle: SLOT_META.top.title,
    slotSections: SLOT_ORDER.map((slot) => ({
      slot,
      title: SLOT_META[slot].title,
      itemLabel: SLOT_META[slot].title.replace('位', ''),
      tip: slot === 'accessories' ? '可叠加多个配饰' : '点击选中该区域'
    })),
    slots: buildEmptySlots(),
    boardSlots: buildBoardSlots(buildEmptySlots()),
    closetItems: [],
    loading: false,
    savingRemote: false,
    lastSavedOutfitId: ''
  },

  onLoad() {
    if (!this.restoreImportedOutfit()) {
      this.restoreDraft();
    }
  },

  onShow() {
    this.fetchClosetItems();
  },

  restoreDraft() {
    const draft = wx.getStorageSync(DRAFT_KEY);
    if (!draft || typeof draft !== 'object') {
      return;
    }
    this.setData({
      slots: {
        ...buildEmptySlots(),
        ...draft.slots
      },
      boardSlots: buildBoardSlots({
        ...buildEmptySlots(),
        ...draft.slots
      }),
      activeSlot: draft.activeSlot || 'top',
      activeSlotTitle: SLOT_META[draft.activeSlot || 'top']?.title || SLOT_META.top.title
    });
  },

  restoreImportedOutfit() {
    const imported = wx.getStorageSync(IMPORT_KEY);
    if (!imported || typeof imported !== 'object' || !imported.slots) {
      return false;
    }

    this.pendingImportSlots = imported.slots;
    this.setData({
      activeSlot: 'top',
      activeSlotTitle: SLOT_META.top.title,
      lastSavedOutfitId: ''
    });
    wx.removeStorageSync(IMPORT_KEY);
    return true;
  },

  persistDraft(nextState = {}) {
    const payload = {
      slots: nextState.slots || this.data.slots,
      activeSlot: nextState.activeSlot || this.data.activeSlot,
      updatedAt: Date.now()
    };
    wx.setStorageSync(DRAFT_KEY, payload);
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
        imageUrl: await resolveImageUrl(item.imageOriginalUrl)
      })));
      this.setData({ closetItems, loading: false });
      if (this.pendingImportSlots) {
        this.applyImportedSlots(this.pendingImportSlots, closetItems);
        this.pendingImportSlots = null;
      }
    } catch (error) {
      console.error('Fetch canvas closet items failed', error);
      this.setData({ loading: false });
      wx.showToast({ title: '加载衣橱失败', icon: 'none' });
    }
  },

  selectSlot(e) {
    const slot = e.currentTarget.dataset.slot;
    this.setData({
      activeSlot: slot,
      activeSlotTitle: SLOT_META[slot]?.title || SLOT_META.top.title
    });
    this.persistDraft({ activeSlot: slot });
  },

  useClosetItem(e) {
    const itemId = e.currentTarget.dataset.id;
    const item = this.data.closetItems.find(entry => entry.id === itemId);
    if (!item) {
      return;
    }

    const slot = this.data.activeSlot || inferSlotFromCategory(item.category);
    if (!slot) {
      wx.showToast({ title: '请先选择放置区域', icon: 'none' });
      return;
    }

    const nextSlots = { ...this.data.slots };
    if (slot === 'accessories') {
      const existing = nextSlots.accessories || [];
      nextSlots.accessories = existing.some(entry => entry.id === item.id)
        ? existing
        : [...existing, item];
    } else {
      nextSlots[slot] = item;
      if (slot === 'dress') {
        nextSlots.bottom = null;
      }
      if (slot === 'bottom') {
        nextSlots.dress = null;
      }
    }

    this.setData({ slots: nextSlots });
    this.setData({ boardSlots: buildBoardSlots(nextSlots) });
    this.persistDraft({ slots: nextSlots });
  },

  removeFromSlot(e) {
    const slot = e.currentTarget.dataset.slot;
    const itemId = e.currentTarget.dataset.id;
    const nextSlots = { ...this.data.slots };

    if (slot === 'accessories') {
      nextSlots.accessories = (nextSlots.accessories || []).filter(item => item.id !== itemId);
    } else {
      nextSlots[slot] = null;
    }

    this.setData({ slots: nextSlots });
    this.setData({ boardSlots: buildBoardSlots(nextSlots) });
    this.persistDraft({ slots: nextSlots });
  },

  clearCanvas() {
    const slots = buildEmptySlots();
    this.setData({
      slots,
      boardSlots: buildBoardSlots(slots),
      activeSlot: 'top',
      activeSlotTitle: SLOT_META.top.title
    });
    this.persistDraft({ slots, activeSlot: 'top' });
    wx.showToast({ title: '已清空画布', icon: 'success' });
  },

  saveCanvasDraft() {
    this.persistDraft();
    wx.showToast({ title: '搭配草稿已保存', icon: 'success' });
  },

  async saveCanvasRecord() {
    const slotsPayload = serializeSlots(this.data.slots);
    if (isCanvasEmpty(slotsPayload)) {
      wx.showToast({ title: '请先放入至少一件单品', icon: 'none' });
      return;
    }

    this.setData({ savingRemote: true });
    try {
      const result = await api.request({
        url: '/api/saved-outfits',
        method: 'POST',
        data: {
          sourceType: 'canvas',
          slots: slotsPayload
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

  applyImportedSlots(slotIds, closetItems = this.data.closetItems) {
    const nextSlots = buildSlotsFromItemIds(slotIds, closetItems);
    this.setData({
      slots: nextSlots,
      boardSlots: buildBoardSlots(nextSlots),
      activeSlot: pickFirstFilledSlot(nextSlots) || 'top',
      activeSlotTitle: SLOT_META[pickFirstFilledSlot(nextSlots) || 'top']?.title || SLOT_META.top.title
    });
    this.persistDraft({
      slots: nextSlots,
      activeSlot: pickFirstFilledSlot(nextSlots) || 'top'
    });
    wx.showToast({ title: '已载入这套搭配', icon: 'success' });
  }
});

function buildEmptySlots() {
  return {
    top: null,
    bottom: null,
    dress: null,
    outer: null,
    shoes: null,
    bag: null,
    accessories: []
  };
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
      return '';
  }
}

function buildBoardSlots(slots) {
  return SLOT_ORDER.map((slot) => ({
    slot,
    title: SLOT_META[slot].title,
    itemLabel: SLOT_META[slot].title.replace('位', ''),
    tip: slot === 'accessories' ? '可叠加多个配饰' : '点击选中该区域',
    item: slot === 'accessories' ? null : slots[slot],
    accessories: slot === 'accessories' ? slots.accessories : []
  }));
}

function serializeSlots(slots) {
  return {
    top: slots.top?.id,
    bottom: slots.bottom?.id,
    dress: slots.dress?.id,
    outer: slots.outer?.id,
    shoes: slots.shoes?.id,
    bag: slots.bag?.id,
    accessories: (slots.accessories || []).map(item => item.id)
  };
}

function isCanvasEmpty(slots) {
  return !slots.top && !slots.bottom && !slots.dress && !slots.outer && !slots.shoes && !slots.bag && (!slots.accessories || slots.accessories.length === 0);
}

function buildSlotsFromItemIds(slotIds, closetItems) {
  const itemMap = new Map((closetItems || []).map((item) => [item.id, item]));
  return {
    top: itemMap.get(slotIds?.top) || null,
    bottom: itemMap.get(slotIds?.bottom) || null,
    dress: itemMap.get(slotIds?.dress) || null,
    outer: itemMap.get(slotIds?.outer) || null,
    shoes: itemMap.get(slotIds?.shoes) || null,
    bag: itemMap.get(slotIds?.bag) || null,
    accessories: (slotIds?.accessories || []).map((id) => itemMap.get(id)).filter(Boolean)
  };
}

function pickFirstFilledSlot(slots) {
  if (slots.top) return 'top';
  if (slots.dress) return 'dress';
  if (slots.bottom) return 'bottom';
  if (slots.outer) return 'outer';
  if (slots.shoes) return 'shoes';
  if (slots.bag) return 'bag';
  if (slots.accessories?.length) return 'accessories';
  return '';
}
