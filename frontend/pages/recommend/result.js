import api from '../../utils/api';

Page({
  data: {
    recommendationId: '',
    looks: [],
    currentSwipe: 0
  },

  onLoad(options) {
    this.setData({ recommendationId: options.id || '' });
  },

  onShow() {
    if (this.data.recommendationId) {
      this.fetchRecommendation();
    }
  },

  async fetchRecommendation() {
    wx.showLoading({ title: '加载中...' });
    try {
      const detail = await api.request({
        url: `/api/recommendations/${this.data.recommendationId}`,
        method: 'GET'
      });
      const looks = await Promise.all((detail.outfits || []).map(async (outfit, index) => ({
        id: `look-${index + 1}`,
        reason: outfit.reason || '推荐已生成',
        items: await Promise.all((outfit.items || []).map(async (itemId) => mapRecommendationItem(itemId))),
        alternative: outfit.alternatives?.[0]
          ? {
              msg: outfit.alternatives[0].reason || `可尝试替换 ${outfit.alternatives[0].replaceItemId}`,
              replaceTarget: outfit.alternatives[0].replaceItemId
            }
          : null
      })));
      this.setData({ looks });
      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      console.error('Fetch recommendation detail failed', error);
      wx.showToast({ title: '加载推荐失败', icon: 'none' });
    }
  },

  onSwiperChange(e) {
    this.setData({ currentSwipe: e.detail.current });
  },

  async onAction(e) {
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
        wx.showToast({ title: '标记为喜欢', icon: 'success' });
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
      name: [detail.attributes?.category, detail.attributes?.subCategory].filter(Boolean).join(' / ') || itemId,
      img: detail.imageOriginalUrl || 'https://dummyimage.com/300x400/E5E7EB/1C1C1E&text=Closet+Item'
    };
  } catch (error) {
    return {
      id: itemId,
      type: '单品',
      name: itemId,
      img: 'https://dummyimage.com/300x400/E5E7EB/1C1C1E&text=Closet+Item'
    };
  }
}

async function submitFeedback(recommendationId, data) {
  return api.request({
    url: `/api/recommendations/${recommendationId}/feedback`,
    method: 'POST',
    data
  });
}
