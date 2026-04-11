import api from '../../utils/api';

Page({
  data: {
    userInfo: {
      avatarUrl: 'https://dummyimage.com/200x200/E5E7EB/1C1C1E&text=User',
      nickName: '加载中',
      signature: 'AI 正在同步你的衣橱画像'
    },
    menus: [
      { id: 'profile', icon: '👤', text: '编辑资料', url: '' },
      { id: 'style-pack', icon: '🧠', text: '风格包管理', url: '/pages/style-pack/index' },
      { id: 'history', icon: '🕘', text: '搭配历史', url: '/pages/history/index' }
    ]
  },

  onShow() {
    this.fetchProfile();
  },

  async fetchProfile() {
    try {
      const profile = await api.request({
        url: '/api/users/profile',
        method: 'GET'
      });
      this.setData({
        userInfo: {
          avatarUrl: profile.avatarUrl || 'https://dummyimage.com/200x200/E5E7EB/1C1C1E&text=User',
          nickName: profile.nickname || '时尚体验官',
          signature: buildSignature(profile)
        }
      });
    } catch (error) {
      console.error('Fetch profile failed', error);
    }
  },

  onMenuClick(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) {
      wx.showToast({ title: '编辑资料功能稍后补充', icon: 'none' });
      return;
    }
    wx.navigateTo({ url });
  }
});

function buildSignature(profile) {
  const style = (profile.stylePreferences || []).join(' / ');
  const city = profile.city || '未设置城市';
  return style ? `${city} · ${style}` : city;
}
