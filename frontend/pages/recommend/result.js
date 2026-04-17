import api from '../../utils/api';
import { resolveImageUrl } from '../../utils/image-url';
import { buildCanvasLayoutFromItems, saveCanvasImportPayload } from '../../utils/canvas-import';

const POLL_INTERVAL_MS = 2500;

Page({
  data: {
    recommendationId: '',
    looks: [],
    currentSwipe: 0,
    status: 'processing',
    loading: true,
    polling: false,
    syncingToCanvas: false
  },

  onLoad(options) {
    this.setData({ recommendationId: options.id || '' });
  },

  onShow() {
    if (this.data.recommendationId) {
      this.fetchRecommendation();
    }
  },

  onHide() {
    this.clearPollTimer();
  },

  onUnload() {
    this.clearPollTimer();
  },

  async fetchRecommendation({ silent = false } = {}) {
    if (!this.data.recommendationId) {
      return;
    }

    if (!silent) {
      this.setData({ loading: true });
    }

    try {
      const detail = await api.request({
        url: `/api/recommendations/${this.data.recommendationId}`,
        method: 'GET'
      });

      const status = detail.status || (detail.outfits?.length ? 'completed' : 'processing');

      if (status === 'processing') {
        this.setData({
          status: 'processing',
          loading: false,
          polling: true
        });
        this.scheduleNextPoll();
        return;
      }

      this.clearPollTimer();

      if (status === 'failed') {
        this.setData({
          status: 'failed',
          looks: [],
          loading: false,
          polling: false
        });
        return;
      }

      const looks = await Promise.all(
        (detail.outfits || []).map(async (outfit, index) => ({
          id: `look-${index + 1}`,
          reason: outfit.reason || '推荐已生成',
          itemIds: outfit.items || [],
          items: await Promise.all(
            (outfit.items || []).map(async (itemId) => mapRecommendationItem(itemId))
          ),
          alternative: outfit.alternatives?.[0]
            ? {
                msg:
                  outfit.alternatives[0].reason ||
                  `可尝试替换 ${outfit.alternatives[0].replaceItemId}`,
                replaceTarget: outfit.alternatives[0].replaceItemId
              }
            : null
        }))
      );

      this.setData({
        looks,
        status: 'completed',
        loading: false,
        polling: false
      });
    } catch (error) {
      console.error('Fetch recommendation detail failed', error);
      this.setData({
        status: 'failed',
        loading: false,
        polling: false
      });
      wx.showToast({ title: '加载推荐失败', icon: 'none' });
    }
  },

  scheduleNextPoll() {
    this.clearPollTimer();
    this.pollTimer = setTimeout(() => {
      this.fetchRecommendation({ silent: true });
    }, POLL_INTERVAL_MS);
  },

  clearPollTimer() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  },

  onSwiperChange(e) {
    this.setData({ currentSwipe: e.detail.current });
  },

  goBackToConfig() {
    wx.navigateBack();
  },

  async syncCurrentLookToCanvas() {
    if (this.data.status !== 'completed' || this.data.syncingToCanvas) {
      return;
    }

    const currentLook = this.data.looks[this.data.currentSwipe];
    if (!currentLook?.itemIds?.length) {
      wx.showToast({ title: '当前推荐还不能同步', icon: 'none' });
      return;
    }

    this.setData({ syncingToCanvas: true });
    try {
      const closetItems = (
        await Promise.all(currentLook.itemIds.map((itemId) => fetchClosetCanvasItem(itemId)))
      ).filter(Boolean);

      if (!closetItems.length) {
        throw new Error('推荐单品读取失败');
      }

      const layoutItems = buildCanvasLayoutFromItems(closetItems);
      saveCanvasImportPayload({
        layoutItems,
        recommendationId: this.data.recommendationId,
        sourceType: 'recommendation-result'
      });

      this.setData({ syncingToCanvas: false });
      wx.navigateTo({ url: '/pages/outfit-canvas/index' });
    } catch (error) {
      console.error('Sync recommendation to canvas failed', error);
      this.setData({ syncingToCanvas: false });
      wx.showToast({ title: '同步到画布失败', icon: 'none' });
    }
  },

  async onAction(e) {
    if (this.data.status !== 'completed') {
      return;
    }

    const action = e.currentTarget.dataset.action;
    const recommendationId = this.data.recommendationId;

    if (action === 'dislike') {
      wx.showActionSheet({
        itemList: ['太热了', '太冷了', '不适合场景', '不喜欢这套风格'],
        success: async ({ tapIndex }) => {
          const reasonTags = ['太热了', '太冷了', '不适合场景', '不喜欢这套风格'];
          await submitFeedback(recommendationId, {
            action: 'dislike',
            reasonTags: [reasonTags[tapIndex]]
          });
          wx.showToast({ title: '已记录反馈', icon: 'none' });
        }
      });
      return;
    }

    try {
      if (action === 'save') {
        await api.request({
          url: `/api/recommendations/${recommendationId}/save`,
          method: 'POST',
          data: {}
        });
        wx.showToast({ title: '已收藏搭配', icon: 'success' });
        return;
      }

      if (action === 'like') {
        await submitFeedback(recommendationId, { action: 'like' });
        wx.showToast({ title: '已标记喜欢', icon: 'success' });
      }
    } catch (error) {
      console.error('Recommendation action failed', error);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  }
});

async function mapRecommendationItem(itemId) {
  try {
    const detail = await api.request({
      url: `/api/closet/items/${itemId}`,
      method: 'GET'
    });
    return {
      id: itemId,
      type: detail.attributes?.category || '单品',
      name:
        [detail.attributes?.category, detail.attributes?.subCategory]
          .filter(Boolean)
          .join(' / ') || itemId,
      img: await resolveImageUrl(detail.imageOriginalUrl)
    };
  } catch (error) {
    return {
      id: itemId,
      type: '单品',
      name: itemId,
      img: ''
    };
  }
}

async function fetchClosetCanvasItem(itemId) {
  try {
    const detail = await api.request({
      url: `/api/closet/items/${itemId}`,
      method: 'GET'
    });
    return {
      itemId,
      category: detail.attributes?.category || ''
    };
  } catch (error) {
    return null;
  }
}

async function submitFeedback(recommendationId, data) {
  return api.request({
    url: `/api/recommendations/${recommendationId}/feedback`,
    method: 'POST',
    data
  });
}
