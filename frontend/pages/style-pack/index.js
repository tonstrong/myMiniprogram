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
      const res = await api.request({ url: '/api/style-packs', method: 'GET' });
      const packs = res.items || res || [];
      this.setData({
        activePacks: packs.filter(p => p.status === 'active' || p.status === 'confirmed'),
        pendingPacks: packs.filter(p => p.status !== 'active' && p.status !== 'confirmed')
      });
    } catch (e) {
      console.error('Fetch style packs err', e);
      // Fallback
      this.setData({
        activePacks: [{ id: 'sp1', name: '通勤极简风', source: 'video', summary: '低饱和、中性色、利落' }],
        pendingPacks: [{ id: 'sp2', name: '日系松弛感', source: 'text', summary: '解析中' }]
      });
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
