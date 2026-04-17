import api from '../../utils/api';
import { getCurrentWeather } from '../../utils/weather';
import { chooseLocationWithPermission, extractCityFromAddress } from '../../utils/city';
import { cacheProfile, getCachedCity } from '../../utils/profile-cache';

Page({
  data: {
    scenes: ['通勤', '约会', '休闲', '旅行', '居家'],
    activeScene: '通勤',
    weather: '正在同步天气',
    weatherPayload: null,
    hasCity: false,
    cityName: '',
    cityBusy: false,
    stylePacks: [{ id: '', name: '无特定风格（日常）' }],
    selectedPack: '',
    isGenerating: false
  },

  onShow() {
    this.cityGuideShown = false;
    this.initializePage();
  },

  async initializePage() {
    await Promise.all([this.fetchStylePacks(), this.prepareWeatherState()]);
  },

  async fetchStylePacks() {
    try {
      const res = await api.request({
        url: '/api/style-packs?pageNo=1&pageSize=50',
        method: 'GET'
      });

      const activePacks = (res.items || [])
        .filter((item) => item.status === 'active')
        .map((item) => ({ id: item.stylePackId, name: item.name }));

      this.setData({
        stylePacks: [{ id: '', name: '无特定风格（日常）' }, ...activePacks],
        selectedPack: activePacks[0]?.id || ''
      });
    } catch (error) {
      console.error('Fetch active style packs failed', error);
    }
  },

  async prepareWeatherState() {
    let city = getCachedCity();

    if (!city) {
      try {
        const profile = await api.request({
          url: '/api/users/profile',
          method: 'GET'
        });
        cacheProfile(profile);
        city = (profile.city || '').trim();
      } catch (error) {
        console.error('Fetch profile before weather failed', error);
      }
    }

    if (!city) {
      this.setData({
        hasCity: false,
        cityName: '',
        weather: '未设置城市，可先生成不带天气的搭配',
        weatherPayload: null
      });
      this.promptCityGuide();
      return;
    }

    this.setData({
      hasCity: true,
      cityName: city
    });
    await this.fetchWeather();
  },

  async fetchWeather(forceRefresh = false) {
    if (!this.data.hasCity) {
      this.setData({
        weather: '未设置城市，可先生成不带天气的搭配',
        weatherPayload: null
      });
      return;
    }

    try {
      const weather = await getCurrentWeather({ forceRefresh });
      this.setData({
        weather: `${weather.city} · ${weather.condition} ${Math.round(weather.temperature)}°C`,
        weatherPayload: {
          temperature: Math.round(weather.temperature),
          condition: weather.condition
        }
      });
    } catch (error) {
      const rawMessage = error?.error?.message || error?.message || '';
      const missingCity =
        error?.code === 'CITY_NOT_SET' || rawMessage.includes('设置所在城市');
      this.setData({
        hasCity: !missingCity && this.data.hasCity,
        weather: missingCity
          ? '未设置城市，可先生成不带天气的搭配'
          : '天气暂不可用，仍可继续生成搭配',
        weatherPayload: null
      });
      if (missingCity) {
        this.promptCityGuide();
      }
    }
  },

  promptCityGuide() {
    if (this.cityGuideShown) {
      return;
    }

    this.cityGuideShown = true;
    wx.showModal({
      title: '先设置所在城市',
      content:
        '设置后可以自动同步天气和温度，让推荐更贴合当天穿搭。现在也可以先跳过，直接生成不带天气的搭配。',
      confirmText: '去设置',
      cancelText: '先跳过',
      success: ({ confirm }) => {
        if (confirm) {
          this.openCityGuide();
        }
      }
    });
  },

  openCityGuide() {
    wx.showActionSheet({
      itemList: ['使用微信定位', '去“我的”页面设置'],
      success: ({ tapIndex }) => {
        if (tapIndex === 0) {
          this.quickLocateCity();
          return;
        }
        wx.switchTab({ url: '/pages/profile/index' });
      }
    });
  },

  async quickLocateCity() {
    this.setData({ cityBusy: true });
    try {
      const location = await chooseLocationWithPermission();
      const city = extractCityFromAddress(location.address || location.name || '');
      if (!city) {
        this.setData({ cityBusy: false });
        wx.showToast({
          title: '未识别到城市，请去“我的”里手动设置',
          icon: 'none'
        });
        return;
      }

      const profile = await api.request({
        url: '/api/users/profile',
        method: 'PUT',
        data: { city }
      });
      cacheProfile(profile);
      this.setData({
        cityBusy: false,
        hasCity: true,
        cityName: profile.city || city
      });
      await this.fetchWeather(true);
      wx.showToast({ title: '城市已更新', icon: 'success' });
    } catch (error) {
      console.error('Quick locate city failed', error);
      this.setData({ cityBusy: false });
      if (error?.errMsg && error.errMsg.includes('cancel')) {
        return;
      }
      wx.showToast({ title: '定位失败，请去“我的”里设置', icon: 'none' });
    }
  },

  selectScene(e) {
    this.setData({ activeScene: e.currentTarget.dataset.scene });
  },

  selectPack(e) {
    this.setData({ selectedPack: e.currentTarget.dataset.id });
  },

  async generateLook() {
    if (this.data.isGenerating) {
      return;
    }

    this.setData({ isGenerating: true });
    try {
      const result = await api.request({
        url: '/api/recommendations/generate',
        method: 'POST',
        data: {
          scene: this.data.activeScene,
          stylePackId: this.data.selectedPack || undefined,
          weather: this.data.weatherPayload || undefined
        }
      });

      this.setData({ isGenerating: false });
      wx.showToast({ title: '已开始生成', icon: 'success' });
      wx.navigateTo({
        url: `/pages/recommend/result?id=${result.recommendationId}`
      });
    } catch (error) {
      this.setData({ isGenerating: false });
      console.error('Generate recommendation failed', error);
      const rawMessage = error?.error?.message || error?.message || '';
      wx.showToast({
        title: mapRecommendationErrorMessage(rawMessage),
        icon: 'none'
      });
    }
  }
});

function mapRecommendationErrorMessage(message) {
  if (!message) {
    return '暂时还不能生成推荐，请先确认至少有 2 件已入库单品';
  }

  if (
    message.includes('No available wardrobe candidates were found') ||
    message.includes('当前衣橱里还没有可用于推荐的单品')
  ) {
    return '先确认并入库至少 2 件单品，再来生成推荐';
  }

  if (message.includes('每天最多 3 次') || message.includes('今日灵感图集生成次数已用完')) {
    return '今日生成次数已用完，明天再来试试';
  }

  return message;
}
