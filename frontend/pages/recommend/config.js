import api from '../../utils/api';

Page({
  data: {
    scenes: ['通勤', '约会', '休闲', '旅行', '居家'],
    activeScene: '通勤',
    weather: '晴天 18°C', // 模拟当前天气
    stylePacks: [
      { id: '', name: '无特定风格 (日常)' }
    ],
    selectedPack: '',
    isGenerating: false
  },

  async onShow() {
    // 动态拉取可用风格包
    try {
      const res = await api.request({ url: '/api/style-packs', method: 'GET' });
      const packs = res.items || res || [];
      const activePacks = packs.filter(p => p.status === 'active' || p.status === 'confirmed');
      this.setData({
        stylePacks: [{ id: '', name: '无特定风格 (日常)' }, ...activePacks]
      });
    } catch(e) { /* keep default mock */ }
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
      const genRes = await api.request({
        url: '/api/recommendations/generate',
        method: 'POST',
        data: {
          scene: this.data.activeScene,
          weather: this.data.weather,
          stylePackId: this.data.selectedPack !== '' ? this.data.selectedPack : undefined,
          preferenceTags: []
        }
      });
      
      const taskRes = await api.pollTaskStatus(genRes.taskId);
      this.setData({ isGenerating: false });
      
      const recId = genRes.recommendationId || taskRes.recommendationId || 'mock_rec_id';
      wx.navigateTo({ url: `/pages/recommend/result?id=${recId}` });
      
    } catch (e) {
      console.error('Generate look error', e);
      this.setData({ isGenerating: false });
      wx.navigateTo({ url: '/pages/recommend/result' });
    }
  }
});
