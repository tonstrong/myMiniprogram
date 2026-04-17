import api from '../../utils/api';
import { resolveImageUrl } from '../../utils/image-url';

const IMPORT_KEY = 'outfit-canvas:import';

Page({
  data: {
    outfits: [],
    loading: false,
    refreshing: false,
    noMore: false,
    pageNo: 1,
    pageSize: 12,
    total: 0,
    backendReady: true,
    backendMessage: '',
    deletingId: ''
  },

  onShow() {
    this.loadSavedOutfits(true);
  },

  onPullDownRefresh() {
    this.setData({ refreshing: true });
    this.loadSavedOutfits(true);
  },

  onReachBottom() {
    if (this.data.loading || this.data.noMore || this.data.outfits.length >= this.data.total) {
      return;
    }
    this.loadSavedOutfits(false);
  },

  async loadSavedOutfits(reset = false) {
    if (this.data.loading && !reset) {
      return;
    }

    const pageNo = reset ? 1 : this.data.pageNo;
    this.setData({ loading: true });

    try {
      const res = await api.request({
        url: `/api/saved-outfits?pageNo=${pageNo}&pageSize=${this.data.pageSize}`,
        method: 'GET'
      });

      const nextItems = await Promise.all((res.items || []).map(async (item) => ({
        id: item.savedOutfitId,
        sourceTypeText: item.sourceType === 'canvas' ? '自由搭配' : '已保存搭配',
        createdAt: item.createdAt,
        createdDateText: formatDate(item.createdAt),
        createdFullDateText: formatFullDate(item.createdAt),
        createdTimeText: formatTime(item.createdAt),
        itemCount: item.itemCount || 0,
        coverImageUrl: await resolveImageUrl(item.coverImageUrl),
        previewItems: await Promise.all((item.previewItems || []).map(async (previewItem, index) => ({
          id: `${item.savedOutfitId}-${previewItem.slotCode}-${previewItem.sortOrder}-${index}`,
          itemId: previewItem.itemId,
          slotCode: previewItem.slotCode,
          sortOrder: previewItem.sortOrder || 0,
          x: toOptionalNumber(previewItem.x),
          y: toOptionalNumber(previewItem.y),
          w: toOptionalNumber(previewItem.w),
          h: toOptionalNumber(previewItem.h),
          layerIndex: toOptionalNumber(previewItem.layerIndex) ?? index,
          imageUrl: await resolveImageUrl(previewItem.imageUrl),
          category: previewItem.category || '',
          subCategory: previewItem.subCategory || '',
          className: getPreviewClassName(previewItem.slotCode, previewItem.sortOrder || 0),
          styleText: buildPreviewStyle(previewItem, index)
        })))
      })));

      const outfits = reset ? nextItems : [...this.data.outfits, ...nextItems];
      const total = typeof res.total === 'number' ? res.total : outfits.length;

      this.setData({
        outfits,
        pageNo: pageNo + 1,
        total,
        noMore: outfits.length >= total,
        backendReady: true,
        backendMessage: '',
        loading: false,
        refreshing: false
      });
      wx.stopPullDownRefresh();
    } catch (error) {
      console.error('Load saved outfits failed', error);
      this.setData({
        backendReady: false,
        backendMessage: '已保存搭配加载失败，请稍后再试。',
        loading: false,
        refreshing: false,
        outfits: reset ? [] : this.data.outfits
      });
      wx.stopPullDownRefresh();
    }
  },

  goCanvas() {
    wx.navigateTo({ url: '/pages/outfit-canvas/index' });
  },

  openOutfit(e) {
    const outfitId = e.currentTarget.dataset.id;
    const outfit = this.data.outfits.find(item => item.id === outfitId);
    if (!outfit) {
      return;
    }

    const payload = buildImportPayload(outfit);
    wx.setStorageSync(IMPORT_KEY, payload);
    wx.navigateTo({ url: '/pages/outfit-canvas/index?source=saved-outfit' });
  },

  deleteOutfit(e) {
    const outfitId = e.currentTarget.dataset.id;
    if (!outfitId || this.data.deletingId) {
      return;
    }

    wx.showModal({
      title: '删除这套搭配',
      content: '删除后会从“我的搭配”中移除，但不会删除衣橱里的单品。',
      confirmText: '删除',
      confirmColor: '#d14343',
      success: async ({ confirm }) => {
        if (!confirm) {
          return;
        }

        this.setData({ deletingId: outfitId });
        try {
          await api.request({
            url: `/api/saved-outfits/${outfitId}`,
            method: 'DELETE'
          });

          wx.showToast({ title: '已删除', icon: 'success' });
          this.setData({ deletingId: '' });
          this.loadSavedOutfits(true);
        } catch (error) {
          console.error('Delete saved outfit failed', error);
          this.setData({ deletingId: '' });
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    });
  }
});

function formatDate(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${month}/${day}`;
}

function formatTime(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatFullDate(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function getPreviewClassName(slotCode, sortOrder) {
  switch (slotCode) {
    case 'outer':
      return 'piece-outer';
    case 'dress':
      return 'piece-dress';
    case 'top':
      return 'piece-top';
    case 'bottom':
      return 'piece-bottom';
    case 'shoes':
      return sortOrder % 2 === 0 ? 'piece-shoes-left' : 'piece-shoes-right';
    case 'bag':
      return 'piece-bag';
    case 'accessories':
      return `piece-accessory piece-accessory-${Math.min(sortOrder, 2)}`;
    default:
      return 'piece-generic';
  }
}

function buildImportPayload(outfit) {
  const hasLayout = (outfit.previewItems || []).some((item) =>
    typeof item.x === 'number' &&
    typeof item.y === 'number' &&
    typeof item.w === 'number' &&
    typeof item.h === 'number'
  );

  if (hasLayout) {
    return {
      source: 'saved-outfit',
      savedOutfitId: outfit.id,
      layoutItems: (outfit.previewItems || []).map((item, index) => ({
        itemId: item.itemId,
        slotCode: item.slotCode,
        x: typeof item.x === 'number' ? item.x : 0.2,
        y: typeof item.y === 'number' ? item.y : 0.2,
        w: typeof item.w === 'number' ? item.w : 0.24,
        h: typeof item.h === 'number' ? item.h : 0.24,
        layerIndex: typeof item.layerIndex === 'number' ? item.layerIndex : index
      })),
      updatedAt: Date.now()
    };
  }

  const slots = {
    top: '',
    bottom: '',
    dress: '',
    outer: '',
    shoes: '',
    bag: '',
    accessories: []
  };

  (outfit.previewItems || []).forEach((item) => {
    if (item.slotCode === 'accessories') {
      slots.accessories.push(item.itemId);
      return;
    }

    if (Object.prototype.hasOwnProperty.call(slots, item.slotCode)) {
      slots[item.slotCode] = item.itemId;
    }
  });

  return {
    source: 'saved-outfit',
    savedOutfitId: outfit.id,
    slots,
    updatedAt: Date.now()
  };
}

function buildPreviewStyle(previewItem, index) {
  const x = toOptionalNumber(previewItem.x);
  const y = toOptionalNumber(previewItem.y);
  const w = toOptionalNumber(previewItem.w);
  const h = toOptionalNumber(previewItem.h);
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof w !== 'number' ||
    typeof h !== 'number'
  ) {
    return '';
  }

  const layerIndex = toOptionalNumber(previewItem.layerIndex) ?? index;
  return `left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${h * 100}%;z-index:${layerIndex + 1};`;
}

function toOptionalNumber(value) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const nextValue = Number(value);
  return Number.isNaN(nextValue) ? undefined : nextValue;
}
