import api from '../../utils/api';

Page({
  data: {
    tabs: ['收藏的搭配', '生成历史'],
    activeTab: 0,
    records: [],
    backendReady: false,
    backendMessage: '正在同步后端能力...'
  },

  onShow() {
    this.loadCapabilityState();
  },

  async loadCapabilityState() {
    try {
      await api.request({
        url: '/api/users/profile',
        method: 'GET'
      });
      this.setData({
        backendReady: true,
        backendMessage: '当前后端已接通，但暂未提供推荐历史列表接口。你仍可在推荐结果页完成保存与反馈。',
        records: []
      });
    } catch (error) {
      console.error('Load history capability state failed', error);
      this.setData({
        backendReady: false,
        backendMessage: '后端连接失败，暂时无法读取历史能力状态。',
        records: []
      });
    }
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.index });
  },

  goRecommend() {
    wx.navigateTo({ url: '/pages/recommend/config' });
  }
});
