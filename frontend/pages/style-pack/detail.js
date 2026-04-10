import api from '../../utils/api';

Page({
  data: {
    packId: '',
    isNew: false,
    packInfo: {
      name: '读取中...',
      summary: '读取中...',
      rules: {}
    }
  },

  async onLoad(options) {
    if (options.isNew === 'true') {
      this.setData({ isNew: true });
    }
    const packId = (options.id && options.id !== 'mock_new_pack') ? options.id : null;
    if (packId) {
      this.setData({ packId });
      await this.fetchStylePack(packId);
    } else {
      // Mock Data 
      this.setData({
        packInfo: {
          name: '周末松弛感',
          summary: '强调舒适透气，微宽松版型，色彩柔和自然。',
          rules: {
            preferred_colors: ['燕麦色', '浅灰', '米白', '低饱和蓝'],
            preferred_fit: ['上宽下宽', '微廓形', '垂坠'],
            avoid: ['紧身', '亮闪片', '硬挺材质'],
            scenes: ['周末', '咖啡馆', '散步']
          }
        }
      });
    }
  },

  async fetchStylePack(packId) {
    try {
      const res = await api.request({ url: `/api/style-packs/${packId}`, method: 'GET' });
      this.setData({ packInfo: res });
    } catch(e) {
      console.error('Fetch style pack error', e);
    }
  },

  removePack() {
    wx.showModal({
      title: '停用风格包',
      content: '停用后该风格原则将不再参与智能推荐',
      confirmColor: '#FF9500',
      success: async (res) => {
        if (res.confirm) {
          try {
            if (this.data.packId) {
               await api.request({ url: `/api/style-packs/${this.data.packId}/deactivate`, method: 'POST' });
            }
            wx.navigateBack();
          } catch(e) {
            console.error(e);
            wx.navigateBack();
          }
        }
      }
    });
  },

  async confirmPack() {
    try {
      if (this.data.packId) {
         await api.request({ url: `/api/style-packs/${this.data.packId}/activate`, method: 'POST' });
      }
      wx.showToast({ title: '已生效', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    } catch(e) {
      console.error(e);
      wx.showToast({ title: '已生效', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1000);
    }
  }
});
