import api from '../../utils/api';

Page({
  data: {
    scenes: ['通勤', '约会', '休闲', '旅行', '居家'],
    activeScene: '通勤',
    weather: '晴天 18°C',
    stylePacks: [{ id: '', name: '无特定风格 (日常)' }],
    selectedPack: '',
    isGenerating: false
  },

  onShow() {
    this.fetchStylePacks();
  },

  async fetchStylePacks() {
    try {
      const res = await api.request({
        url: '/api/style-packs?pageNo=1&pageSize=50',
        method: 'GET'
      });

      const activePacks = (res.items || [])
        .filter(item => item.status === 'active')
        .map(item => ({ id: item.stylePackId, name: item.name }));

      this.setData({
        stylePacks: [{ id: '', name: '无特定风格 (日常)' }, ...activePacks],
        selectedPack: activePacks[0]?.id || ''
      });
    } catch (error) {
      console.error('Fetch active style packs failed', error);
    }
  },

  selectScene(e) {
    this.setData({ activeScene: e.currentTarget.dataset.scene });
  },

  selectPack(e) {
    this.setData({ selectedPack: e.currentTarget.dataset.id });
  },

  async generateLook() {
    this.setData({ isGenerating: true });
    try {
      const result = await api.request({
        url: '/api/recommendations/generate',
        method: 'POST',
        data: {
          scene: this.data.activeScene,
          stylePackId: this.data.selectedPack || undefined
        }
      });
      this.setData({ isGenerating: false });
      wx.navigateTo({ url: `/pages/recommend/result?id=${result.recommendationId}` });
    } catch (error) {
      this.setData({ isGenerating: false });
      console.error('Generate recommendation failed', error);
      const message = error?.error?.message || error?.message || '生成失败，请先确认至少有 2 件已入库单品';
      wx.showToast({ title: message, icon: 'none' });
    }
  }
});
