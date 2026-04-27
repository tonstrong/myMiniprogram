import api from '../../utils/api';
import { resolveImageUrl } from '../../utils/image-url';
import { getCurrentWeather } from '../../utils/weather';
import { cacheProfile } from '../../utils/profile-cache';

const LOCAL_AVATAR_KEY = 'profile:localAvatarUrl';
const DEFAULT_AVATAR_URL = '';

Page({
  data: {
    profile: null,
    userInfo: {
      avatarUrl: DEFAULT_AVATAR_URL,
      nickName: '加载中',
      signature: 'AI 正在同步你的衣橱画像'
    },
    stats: [
      { id: 'closet', value: '--', label: '单品' },
      { id: 'style-pack', value: '--', label: '风格包' },
      { id: 'saved-outfits', value: '--', label: '我的搭配' }
    ],
    cityUi: {
      value: '',
      isSaving: false,
      isLocating: false,
      lastSource: 'profile'
    },
    weatherHint: '',
    menus: [
      { id: 'profile', icon: 'icon-user', text: '编辑资料', url: '' },
      { id: 'style-pack', icon: 'icon-style', text: '风格包管理', url: '/pages/style-pack/index' },
      { id: 'saved-outfits', icon: 'icon-outfit', text: '我的搭配', url: '/pages/saved-outfits/index' },
      { id: 'history', icon: 'icon-history', text: '搭配历史', url: '/pages/history/index' }
    ]
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.loadProfilePage();
  },

  async loadProfilePage() {
    const [profileResult, closetResult, stylePackResult, savedOutfitResult] = await Promise.allSettled([
      api.request({
        url: '/api/users/profile',
        method: 'GET'
      }),
      api.request({
        url: '/api/closet/items?pageNo=1&pageSize=1',
        method: 'GET'
      }),
      api.request({
        url: '/api/style-packs?pageNo=1&pageSize=1',
        method: 'GET'
      }),
      api.request({
        url: '/api/saved-outfits?pageNo=1&pageSize=1',
        method: 'GET'
      })
    ]);

    if (profileResult.status === 'fulfilled') {
      const profile = profileResult.value;
      const localAvatarUrl = wx.getStorageSync(LOCAL_AVATAR_KEY) || '';
      const resolvedAvatarUrl = await resolveProfileAvatarUrl(profile.avatarUrl, localAvatarUrl);
      const nextCity = profile.city || '';
      this.setData({
        profile,
        userInfo: {
          avatarUrl: resolvedAvatarUrl || DEFAULT_AVATAR_URL,
          nickName: profile.nickname || '时尚体验官',
          signature: buildSignature(profile)
        },
        cityUi: {
          ...this.data.cityUi,
          value: nextCity,
          isSaving: false,
          isLocating: false,
          lastSource: 'profile'
        }
      });
      cacheProfile(profile);

      if (nextCity) {
        this.loadWeatherHint(false);
      } else {
        this.setData({ weatherHint: '' });
      }
    } else {
      console.error('Fetch profile failed', profileResult.reason);
    }

    this.setData({
      stats: [
        { id: 'closet', value: getTotalCount(closetResult), label: '单品' },
        { id: 'style-pack', value: getTotalCount(stylePackResult), label: '风格包' },
        { id: 'saved-outfits', value: getTotalCount(savedOutfitResult), label: '我的搭配' }
      ]
    });
  },

  async onChooseAvatar(e) {
    const avatarUrl = e?.detail?.avatarUrl;
    if (!avatarUrl) {
      wx.showToast({ title: '未获取到头像', icon: 'none' });
      return;
    }

    wx.setStorageSync(LOCAL_AVATAR_KEY, avatarUrl);
    const app = getApp();
    if (app?.globalData) {
      app.globalData.userInfo = {
        ...(app.globalData.userInfo || {}),
        avatarUrl
      };
    }
    this.setData({
      'userInfo.avatarUrl': avatarUrl
    });
    wx.showLoading({ title: '正在保存头像...' });
    try {
      const imageBase64 = await readFileAsBase64(avatarUrl);
      const profile = await api.request({
        url: '/api/users/avatar',
        method: 'POST',
        data: {
          imageBase64,
          contentType: inferImageContentType(avatarUrl),
          filename: avatarUrl.split('/').pop() || 'avatar.jpg'
        }
      });
      const nextProfile = {
        ...(this.data.profile || {}),
        ...profile,
        avatarUrl: profile.avatarUrl || avatarUrl
      };
      const resolvedAvatarUrl = await resolveProfileAvatarUrl(
        nextProfile.avatarUrl,
        avatarUrl
      );

      wx.removeStorageSync(LOCAL_AVATAR_KEY);
      this.setData({
        profile: nextProfile,
        'userInfo.avatarUrl': resolvedAvatarUrl || avatarUrl,
        'userInfo.signature': buildSignature(nextProfile)
      });
      cacheProfile(nextProfile);

      const savedApp = getApp();
      if (savedApp?.globalData) {
        savedApp.globalData.userInfo = {
          ...(savedApp.globalData.userInfo || {}),
          avatarUrl: resolvedAvatarUrl || avatarUrl
        };
      }
      wx.hideLoading();
      wx.showToast({ title: '头像已保存', icon: 'success' });
      return;
    } catch (error) {
      wx.hideLoading();
      console.error('Save avatar failed', error);
      wx.showToast({ title: '头像保存失败', icon: 'none' });
      return;
    }
  },

  onNicknameBlur(e) {
    const nickname = e.detail.value;
    if (nickname && nickname !== this.data.userInfo.nickName) {
      this.saveNicknameValue(nickname);
    }
  },

  fetchWechatNickname() {
    if (typeof wx.getUserProfile !== 'function') {
      wx.showToast({ title: '当前基础库不支持获取微信昵称，请手动填写', icon: 'none' });
      this.openManualNicknameEditor();
      return;
    }

    wx.getUserProfile({
      desc: '用于完善你的昵称资料',
      success: ({ userInfo }) => {
        const nickname = userInfo?.nickName || '';
        if (!nickname) {
          wx.showToast({ title: '未获取到昵称，请手动填写', icon: 'none' });
          this.openManualNicknameEditor();
          return;
        }
        this.saveNicknameValue(nickname);
      },
      fail: (error) => {
        console.error('Fetch WeChat nickname failed', error);
        wx.showToast({ title: '未获取到微信昵称，请手动填写', icon: 'none' });
      }
    });
  },

  openManualNicknameEditor() {
    wx.showModal({
      title: '填写昵称',
      editable: true,
      placeholderText: '请输入昵称',
      content: this.data.userInfo.nickName === '时尚体验官' ? '' : this.data.userInfo.nickName,
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        this.saveNicknameValue(res.content || '');
      }
    });
  },

  async saveNicknameValue(nickname) {
    const nextNickname = (nickname || '').trim();
    if (!nextNickname) {
      wx.showToast({ title: '请填写昵称', icon: 'none' });
      return;
    }

    try {
      const profile = await api.request({
        url: '/api/users/profile',
        method: 'PUT',
        data: { nickname: nextNickname }
      });

      const nextProfile = {
        ...(this.data.profile || {}),
        ...profile,
        nickname: profile.nickname || nextNickname
      };

      this.setData({
        profile: nextProfile,
        'userInfo.nickName': nextProfile.nickname || nextNickname,
        'userInfo.signature': buildSignature(nextProfile)
      });
      cacheProfile(nextProfile);
      const app = getApp();
      if (app?.globalData) {
        app.globalData.userInfo = {
          ...(app.globalData.userInfo || {}),
          nickName: nextProfile.nickname || nextNickname
        };
      }
      wx.showToast({ title: '昵称已保存', icon: 'success' });
    } catch (error) {
      console.error('Save nickname failed', error);
      wx.showToast({ title: '昵称保存失败', icon: 'none' });
    }
  },

  async saveCityValue(city, source = 'manual') {
    const nextCity = (city || '').trim();
    if (!nextCity) {
      wx.showToast({ title: '请填写城市', icon: 'none' });
      return;
    }

    this.setData({ 'cityUi.isSaving': true });
    try {
      const profile = await api.request({
        url: '/api/users/profile',
        method: 'PUT',
        data: { city: nextCity }
      });

      const nextProfile = {
        ...(this.data.profile || {}),
        ...profile,
        city: profile.city || nextCity
      };

      this.setData({
        profile: nextProfile,
        'userInfo.signature': buildSignature(nextProfile),
        'cityUi.value': nextProfile.city || nextCity,
        'cityUi.isSaving': false,
        'cityUi.lastSource': source
      });
      cacheProfile(nextProfile);
      this.loadWeatherHint(source === 'location');
      wx.showToast({ title: '城市已保存', icon: 'success' });
    } catch (error) {
      console.error('Save city failed', error);
      this.setData({ 'cityUi.isSaving': false });
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  async openCityActions() {
    wx.showActionSheet({
      itemList: ['使用当前位置', '手动输入城市'],
      success: ({ tapIndex }) => {
        if (tapIndex === 0) {
          this.locateCity();
          return;
        }
        this.openManualCityEditor();
      }
    });
  },

  openManualCityEditor() {
    wx.showModal({
      title: '手动修改城市',
      editable: true,
      placeholderText: '请输入城市名称',
      content: this.data.cityUi.value || '',
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        this.saveCityValue(res.content || '', 'manual');
      }
    });
  },

  async locateCity() {
    this.setData({ 'cityUi.isLocating': true });
    try {
      const location = await chooseLocationWithPermission();
      const city = extractCityFromAddress(location.address || location.name || '');
      if (!city) {
        this.setData({
          'cityUi.isLocating': false
        });
        wx.showToast({ title: '未识别到城市，请手动输入', icon: 'none' });
        this.openManualCityEditor();
        return;
      }

      this.setData({
        'cityUi.isLocating': false,
        'cityUi.lastSource': 'location'
      });
      this.saveCityValue(city, 'location');
    } catch (error) {
      console.error('Locate city failed', error);
      this.setData({ 'cityUi.isLocating': false });
      if (error && error.errMsg && error.errMsg.includes('cancel')) {
        return;
      }
      wx.showToast({ title: '定位失败，请检查权限', icon: 'none' });
    }
  },

  onMenuClick(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) {
      wx.showToast({ title: '编辑资料功能稍后补充', icon: 'none' });
      return;
    }
    wx.navigateTo({ url });
  },

  async loadWeatherHint(forceRefresh) {
    try {
      const weather = await getCurrentWeather({ forceRefresh });
      this.setData({
        weatherHint: `${weather.city} · ${weather.condition} ${Math.round(weather.temperature)}°C`
      });
    } catch (error) {
      this.setData({ weatherHint: '' });
    }
  }
});

function buildSignature(profile) {
  const style = (profile.stylePreferences || []).join(' / ');
  const city = profile.city || '未设置城市';
  return style ? `${city} · ${style}` : city;
}

function chooseLocationWithPermission() {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success(settingRes) {
        const auth = settingRes.authSetting['scope.userLocation'];
        if (auth === false) {
          wx.showModal({
            title: '需要定位权限',
            content: '用于识别你当前所在城市，后续可联动天气与温度推荐穿搭。',
            success(modalRes) {
              if (!modalRes.confirm) {
                reject(new Error('location permission denied'));
                return;
              }

              wx.openSetting({
                success(openRes) {
                  if (openRes.authSetting['scope.userLocation']) {
                    openChooseLocation(resolve, reject);
                    return;
                  }
                  reject(new Error('location permission denied'));
                },
                fail: reject
              });
            }
          });
          return;
        }

        openChooseLocation(resolve, reject);
      },
      fail: reject
    });
  });
}

function openChooseLocation(resolve, reject) {
  wx.chooseLocation({
    success: resolve,
    fail: reject
  });
}

function extractCityFromAddress(address) {
  if (!address) {
    return '';
  }

  const normalized = address.replace(/\s+/g, '');
  const directCity = normalized.match(/(北京市|上海市|天津市|重庆市|香港特别行政区|澳门特别行政区)/);
  if (directCity) {
    return directCity[0];
  }

  const cityMatch = normalized.match(/([^省自治区特别行政区]+市)/);
  if (cityMatch) {
    return cityMatch[1];
  }

  return '';
}

function getTotalCount(result) {
  if (result.status !== 'fulfilled') {
    return '--';
  }

  const payload = result.value || {};
  if (typeof payload.total === 'number') {
    return payload.total;
  }

  if (Array.isArray(payload.items)) {
    return payload.items.length;
  }

  return '--';
}

function readFileAsBase64(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (res) => resolve(res.data),
      fail: reject
    });
  });
}

function inferImageContentType(filePath) {
  const lower = (filePath || '').toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

async function resolveProfileAvatarUrl(remoteUrl, fallbackUrl = '') {
  const normalizedRemoteUrl = normalizeProfileAvatarUrl(remoteUrl);
  if (!normalizedRemoteUrl) {
    return fallbackUrl || '';
  }

  try {
    const resolved = await resolveImageUrl(normalizedRemoteUrl);
    return resolved || fallbackUrl || normalizedRemoteUrl;
  } catch (error) {
    console.error('Resolve profile avatar failed', error);
    return fallbackUrl || normalizedRemoteUrl;
  }
}

function normalizeProfileAvatarUrl(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }

  if (
    url.startsWith('wxfile://') ||
    url.startsWith('http://tmp/') ||
    url.startsWith('https://tmp/')
  ) {
    return '';
  }

  return url;
}
