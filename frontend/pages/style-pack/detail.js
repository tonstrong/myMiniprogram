import api from '../../utils/api';

Page({
  data: {
    isNew: false,
    stylePackId: '',
    packInfo: {
      name: '',
      summary: '',
      rules: {
        preferred_colors: [],
        preferred_fit: [],
        avoid: [],
        scenes: []
      }
    }
  },

  onLoad(options) {
    this.setData({
      stylePackId: options.id || '',
      isNew: options.isNew === '1'
    });
  },

  onShow() {
    if (this.data.stylePackId) {
      this.fetchDetail();
    }
  },

  async fetchDetail() {
    try {
      const detail = await api.request({
        url: `/api/style-packs/${this.data.stylePackId}`,
        method: 'GET'
      });
      this.setData({
        packInfo: mapStylePackDetail(detail),
        isNew: this.data.isNew || detail.status !== 'active'
      });
    } catch (error) {
      console.error('Fetch style pack detail failed', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async removePack() {
    try {
      await api.request({
        url: `/api/style-packs/${this.data.stylePackId}/deactivate`,
        method: 'POST',
        data: {}
      });
      wx.showToast({ title: '已停用', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (error) {
      console.error('Deactivate style pack failed', error);
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  async confirmPack() {
    try {
      await api.request({
        url: `/api/style-packs/${this.data.stylePackId}/activate`,
        method: 'POST',
        data: {}
      });
      wx.showToast({ title: '已生效', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 600);
    } catch (error) {
      console.error('Activate style pack failed', error);
      wx.showToast({ title: '生效失败', icon: 'none' });
    }
  }
});

function mapStylePackDetail(detail) {
  const rulesJson = detail.rulesJson || {};
  return {
    name: detail.name || '未命名风格包',
    summary: detail.summaryText || detail.transcriptText || '尚未补充风格摘要',
    rules: {
      preferred_colors: rulesJson.preferred_colors || rulesJson.colors || [],
      preferred_fit: rulesJson.preferred_fit || rulesJson.fit || [],
      avoid: rulesJson.avoid || [],
      scenes: rulesJson.scenes || []
    }
  };
}
