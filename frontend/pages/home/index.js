import api from '../../utils/api';
import { getCurrentWeather } from '../../utils/weather';
import { cacheProfile } from '../../utils/profile-cache';
import { buildCanvasLayoutFromItems, saveCanvasImportPayload } from '../../utils/canvas-import';

const LOCAL_AVATAR_KEY = 'profile:localAvatarUrl';
const DEFAULT_AVATAR_URL = '';
const PROFILE_GUIDE_SHOWN_KEY = 'profile:completionGuideShown';

Page({
  data: {
    userName: '时尚体验家',
    avatarUrl: DEFAULT_AVATAR_URL,
    greeting: '你好',
    currentDateText: '',
    tasks: [],
    closetCount: 0,
    stylePackCount: 0,
    generatingTodayCanvas: false,
    todayRecommend: {
      title: '今日推荐',
      scene: '通勤',
      weather: '以当前衣橱为准',
      reason: '先补齐衣橱与风格包，AI 才能生成更准确的推荐。',
      image: '',
      canGenerate: false,
      weatherPayload: null,
      stylePackId: ''
    }
  },

  onLoad() {
    this.setGreeting();
    this.setCurrentDate();
  },

  onShow() {
    this.loadDashboard();
  },

  setGreeting() {
    const hour = new Date().getHours();
    let greeting = '你好';
    if (hour < 12) greeting = '早上好';
    else if (hour < 18) greeting = '下午好';
    else greeting = '晚上好';
    this.setData({ greeting });
  },

  setCurrentDate() {
    const now = new Date();
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    this.setData({
      currentDateText: `${now.getMonth() + 1}月${now.getDate()}日 ${weekdays[now.getDay()]}`
    });
  },

  async loadDashboard() {
    try {
      const [profile, closetRes, stylePackRes] = await Promise.all([
        api.request({ url: '/api/users/profile', method: 'GET' }),
        api.request({ url: '/api/closet/items?pageNo=1&pageSize=50', method: 'GET' }),
        api.request({ url: '/api/style-packs?pageNo=1&pageSize=50', method: 'GET' })
      ]);

      cacheProfile(profile);

      const closetItems = closetRes.items || [];
      const stylePacks = stylePackRes.items || [];
      const activeClosetCount = closetItems.filter((item) => item.status === 'active').length;
      const activeStylePacks = stylePacks.filter((item) => item.status === 'active');
      const pendingClosetCount = closetItems.filter((item) => item.status !== 'active').length;
      const pendingStylePackCount = stylePacks.filter((item) => item.status !== 'active').length;
      const weather = profile.city ? await getCurrentWeather().catch(() => null) : null;

      this.setData({
        userName: profile.nickname || '时尚体验家',
        avatarUrl: wx.getStorageSync(LOCAL_AVATAR_KEY) || profile.avatarUrl || DEFAULT_AVATAR_URL,
        closetCount: closetItems.length,
        stylePackCount: activeStylePacks.length,
        tasks: buildTasks(pendingClosetCount, pendingStylePackCount),
        todayRecommend: buildRecommendCard({
          activeClosetCount,
          activeStylePacks,
          weather
        })
      });

      this.maybeShowProfileGuide(profile);
    } catch (error) {
      console.error('Load home dashboard failed', error);
      wx.showToast({ title: '首页加载失败', icon: 'none' });
    }
  },

  maybeShowProfileGuide(profile) {
    const alreadyShown = wx.getStorageSync(PROFILE_GUIDE_SHOWN_KEY);
    if (alreadyShown) {
      return;
    }

    const hasNickname = !!(profile.nickname && profile.nickname.trim());
    const hasAvatar = !!(wx.getStorageSync(LOCAL_AVATAR_KEY) || profile.avatarUrl);

    if (hasNickname && hasAvatar) {
      wx.setStorageSync(PROFILE_GUIDE_SHOWN_KEY, 'done');
      return;
    }

    wx.setStorageSync(PROFILE_GUIDE_SHOWN_KEY, 'shown');
    wx.showModal({
      title: '完善头像和昵称',
      content: '为了让首页问候和“我的”页面展示更完整，建议先去完善头像和昵称。',
      confirmText: '去完善',
      cancelText: '稍后',
      success: ({ confirm }) => {
        if (confirm) {
          wx.switchTab({ url: '/pages/profile/index' });
        }
      }
    });
  },

  handleTask(e) {
    const action = e.currentTarget.dataset.action;
    if (action === 'closet') {
      wx.switchTab({ url: '/pages/closet/index' });
      return;
    }
    if (action === 'style-pack') {
      wx.navigateTo({ url: '/pages/style-pack/index' });
    }
  },

  goUpload() {
    wx.navigateTo({ url: '/pages/closet/upload' });
  },

  goRecommend() {
    wx.navigateTo({ url: '/pages/recommend/config' });
  },

  goStylePack() {
    wx.navigateTo({ url: '/pages/style-pack/index' });
  },

  goCanvas() {
    wx.navigateTo({ url: '/pages/outfit-canvas/index' });
  },

  async generateTodayLookToCanvas() {
    const todayRecommend = this.data.todayRecommend || {};
    if (!todayRecommend.canGenerate) {
      wx.showToast({ title: '先准备至少 2 件已入库单品', icon: 'none' });
      return;
    }

    this.setData({ generatingTodayCanvas: true });
    try {
      const generateResult = await api.request({
        url: '/api/recommendations/generate',
        method: 'POST',
        data: {
          scene: todayRecommend.scene,
          stylePackId: todayRecommend.stylePackId || undefined,
          weather: todayRecommend.weatherPayload || undefined
        }
      });

      const detail = await api.request({
        url: `/api/recommendations/${generateResult.recommendationId}`,
        method: 'GET'
      });

      const outfit = detail.outfits?.[0];
      if (!outfit?.items?.length) {
        throw new Error('未生成可用搭配');
      }

      const closetItems = (await Promise.all(
        outfit.items.map((itemId) => fetchClosetCanvasItem(itemId))
      )).filter(Boolean);

      if (!closetItems.length) {
        throw new Error('推荐单品读取失败');
      }

      const layoutItems = buildCanvasLayoutFromItems(closetItems);
      const savedOutfit = await api.request({
        url: '/api/saved-outfits',
        method: 'POST',
        data: {
          sourceType: 'canvas',
          layoutItems
        }
      });

      saveCanvasImportPayload({
        layoutItems,
        recommendationId: generateResult.recommendationId,
        sourceType: 'daily-recommend',
        savedOutfitId: savedOutfit.savedOutfitId
      });

      this.setData({ generatingTodayCanvas: false });
      wx.navigateTo({ url: '/pages/outfit-canvas/index' });
    } catch (error) {
      console.error('Generate daily look to canvas failed', error);
      this.setData({ generatingTodayCanvas: false });
      wx.showToast({
        title: mapDailyCanvasError(error),
        icon: 'none'
      });
    }
  }
});

function buildTasks(pendingClosetCount, pendingStylePackCount) {
  const tasks = [];
  if (pendingClosetCount > 0) {
    tasks.push({
      id: 'closet-pending',
      type: 'upload',
      title: `${pendingClosetCount} 件单品待确认`,
      action: 'closet'
    });
  }
  if (pendingStylePackCount > 0) {
    tasks.push({
      id: 'style-pending',
      type: 'style',
      title: `${pendingStylePackCount} 个风格包待生效`,
      action: 'style-pack'
    });
  }
  return tasks;
}

function buildRecommendCard({ activeClosetCount, activeStylePacks, weather }) {
  const weekday = new Date().getDay();
  const scene = weekday === 0 || weekday === 6 ? '休闲' : '通勤';
  const weatherPayload = weather
    ? {
        temperature: Math.round(weather.temperature),
        condition: weather.condition
      }
    : null;
  const weatherText = weather
    ? `${weather.city} · ${weather.condition} ${Math.round(weather.temperature)}°C`
    : `已入库 ${activeClosetCount} 件单品`;

  if (activeClosetCount < 2) {
    return {
      title: '今日推荐',
      scene,
      weather: weatherText,
      reason: '至少需要 2 件已入库单品，先去确认更多衣橱内容吧。',
      image: '',
      canGenerate: false,
      weatherPayload,
      stylePackId: activeStylePacks[0]?.stylePackId || ''
    };
  }

  if (activeStylePacks.length === 0) {
    return {
      title: '今日推荐',
      scene,
      weather: weatherText,
      reason: weather
        ? `当前 ${weather.condition} ${Math.round(weather.temperature)}°C，基础推荐条件已满足，激活一个风格包会让建议更贴近你的偏好。`
        : '你已经具备基础推荐条件，激活一个风格包会让结果更贴近你的偏好。',
      image: '',
      canGenerate: true,
      weatherPayload,
      stylePackId: ''
    };
  }

  return {
    title: '今日推荐',
    scene,
    weather: weatherText,
    reason: weather
      ? `当前 ${weather.condition} ${Math.round(weather.temperature)}°C，衣橱和风格包都已准备好，可以一键生成并落到画布继续编辑。`
      : '衣橱和风格包都已准备好，可以一键生成今日搭配并落到画布继续编辑。',
    image: '',
    canGenerate: true,
    weatherPayload,
    stylePackId: activeStylePacks[0]?.stylePackId || ''
  };
}

async function fetchClosetCanvasItem(itemId) {
  try {
    const detail = await api.request({
      url: `/api/closet/items/${itemId}`,
      method: 'GET'
    });
    return {
      itemId,
      category: detail.attributes?.category || ''
    };
  } catch (error) {
    return null;
  }
}

function mapDailyCanvasError(error) {
  const message = error?.error?.message || error?.message || '';
  if (!message) {
    return '生成到画布失败';
  }
  if (message.includes('No available wardrobe candidates were found')) {
    return '先确认并入库至少 2 件单品';
  }
  return message;
}
