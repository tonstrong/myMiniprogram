import api from './utils/api';

App({
  onLaunch() {
    this.initCloud();
    this.login();
  },

  initCloud() {
    if (wx.cloud && typeof wx.cloud.init === 'function') {
      wx.cloud.init({
        env: wx.cloud.DYNAMIC_CURRENT_ENV,
        traceUser: true
      });
    }
  },

  login() {
    const cachedToken = wx.getStorageSync('token') || '';
    const cachedUserId = wx.getStorageSync('userId') || '';

    if (cachedToken && cachedUserId) {
      this.globalData.userInfo = this.globalData.userInfo || { nickName: '时尚体验官' };
      this.globalData.userId = cachedUserId;
      this.globalData.loginPromise = Promise.resolve(cachedToken);
      this.refreshLoginBinding(cachedUserId);
      return this.globalData.loginPromise;
    }

    const loginTask = this.performWechatLogin(cachedUserId);

    this.globalData.loginPromise = loginTask.catch((error) => {
      console.error('Login bootstrap failed', error);
      this.globalData.userInfo = { nickName: '游客(离线)' };
      return '';
    });

    return this.globalData.loginPromise;
  },

  performWechatLogin(legacyUserId = '') {
    return new Promise((resolve, reject) => {
      wx.login({
        success: async (res) => {
          if (!res.code) {
            reject(new Error('wx.login no code'));
            return;
          }

          try {
            const result = await api.request({
              url: '/api/auth/wechat-login',
              method: 'POST',
              data: {
                code: res.code,
                legacyUserId: legacyUserId || undefined
              }
            });

            wx.setStorageSync('token', result.token);
            wx.setStorageSync('userId', result.userInfo?.userId || '');
            this.globalData.userInfo = result.userInfo || { nickName: '时尚体验官' };
            this.globalData.userId = result.userInfo?.userId || '';
            resolve(result.token);
          } catch (error) {
            console.error('Login to backend failed', error);
            reject(error);
          }
        },
        fail: reject
      });
    });
  },

  refreshLoginBinding(legacyUserId) {
    this.performWechatLogin(legacyUserId).catch((error) => {
      console.error('Refresh login binding failed', error);
    });
  },

  globalData: {
    userInfo: null,
    userId: '',
    themeMode: 'light'
  }
});
