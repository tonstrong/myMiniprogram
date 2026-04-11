import api from '../../utils/api';

Page({
  data: {
    activePacks: [],
    pendingPacks: []
  },

  onShow() {
    this.fetchPacks();
  },

  async fetchPacks() {
    try {
      const res = await api.request({
        url: '/api/style-packs?pageNo=1&pageSize=50',
        method: 'GET'
      });

      const records = (res.items || []).map(item => ({
        id: item.stylePackId,
        name: item.name,
        source: item.sourceType,
        summary: `${item.status === 'active' ? '已生效' : '待确认'} · 版本 ${item.version || 1}`,
        status: item.status
      }));

      this.setData({
        activePacks: records.filter(item => item.status === 'active'),
        pendingPacks: records.filter(item => item.status !== 'active')
      });
    } catch (error) {
      console.error('Fetch style packs failed', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  goImport() {
    wx.navigateTo({ url: '/pages/style-pack/import' });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/style-pack/detail?id=' + id });
  }
});
