import api from './utils/api';

App({
  onLaunch() {
    this.login();
  },
  
  login() {
    const loginTask = new Promise((resolve, reject) => {
      wx.login({
        success: async (res) => {
          if (res.code) {
            try {
              const result = await api.request({
                url: '/api/auth/wechat-login',
                method: 'POST',
                data: { code: res.code }
              });
              wx.setStorageSync('token', result.token);
              wx.setStorageSync('userId', result.userInfo?.userId || '');
              this.globalData.userInfo = result.userInfo || { nickName: '时尚体验官' };
              this.globalData.userId = result.userInfo?.userId || '';
              resolve(result.token);
            } catch (e) {
              console.error("Login to backend failed", e);
              reject(e);
            }
          } else {
            reject(new Error('wx.login no code'));
          }
        },
        fail: reject
      });
    });

    this.globalData.loginPromise = loginTask.catch(e => {
        // Fallback for visual mock when backend is missing
        this.globalData.userInfo = { nickName: '游客(脱机)' };
        return '';
    });

    return this.globalData.loginPromise;
  },

  globalData: {
    userInfo: null,
    userId: '',
    themeMode: 'light' // Ready for dark mode later
  }
});
