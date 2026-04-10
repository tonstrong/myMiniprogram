Page({
  data: {
    userInfo: {
      avatarUrl: 'https://dummyimage.com/160x160/1C1C1E/FFFFFF?text=User',
      nickName: '时尚体验�?,
      signature: 'Less is more.'
    },
    menus: [
      { id: 'history', icon: '🕒', text: '历史推荐与收�?, url: '/pages/history/index' },
      { id: 'prefs', icon: '�?, text: '穿搭偏好设置', url: '' },
      { id: 'styles', icon: '🎨', text: '管理风格�?, url: '/pages/style-pack/index' },
      { id: 'privacy', icon: '🔒', text: '授权与隐私保�?, url: '' }
    ]
  },

  onLoad() {
    // onLoad logic if needed
  },

  onMenuClick(e) {
    const url = e.currentTarget.dataset.url;
    if (url) {
      wx.navigateTo({ url });
    } else {
      wx.showToast({
        title: '该功能即将开�?,
        icon: 'none'
      });
    }
  }
});
