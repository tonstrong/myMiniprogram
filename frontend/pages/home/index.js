import api from '../../utils/api';
import { getCurrentWeather } from '../../utils/weather';
import { cacheProfile } from '../../utils/profile-cache';

const LOCAL_AVATAR_KEY = 'profile:localAvatarUrl';
const DEFAULT_AVATAR_URL = '';
const PROFILE_GUIDE_SHOWN_KEY = 'profile:completionGuideShown';
const CLOSET_PENDING_HIGHLIGHT_KEY = 'closet:highlightPendingFromHome';

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
    todayRecommend: buildFallbackRecommendCard({
      activeClosetCount: 0,
      activeStylePacks: [],
      weather: null
    })
  },

  onLoad() {
    if (typeof wx.showShareMenu === 'function') {
      wx.showShareMenu({
        menus: ['shareAppMessage', 'shareTimeline']
      });
    }
    this.setGreeting();
    this.setCurrentDate();
  },

  onShareAppMessage() {
    return {
      title: '想想明天穿什么',
      path: '/pages/home/index'
    };
  },

  onShareTimeline() {
    return {
      title: '想想明天穿什么'
    };
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
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
      const [profile, closetRes, stylePackRes, homeDailyRecommend] = await Promise.all([
        api.request({ url: '/api/users/profile', method: 'GET' }),
        api.request({ url: '/api/closet/items?pageNo=1&pageSize=50', method: 'GET' }),
        api.request({ url: '/api/style-packs?pageNo=1&pageSize=50', method: 'GET' }),
        api.request({ url: '/api/recommendations/home-daily', method: 'GET' }).catch(() => null)
      ]);

      cacheProfile(profile);

      const closetItems = closetRes.items || [];
      const stylePacks = stylePackRes.items || [];
      const activeClosetCount = closetItems.filter((item) => item.status === 'active').length;
      const activeStylePacks = stylePacks.filter((item) => item.status === 'active');
      const pendingClosetItems = closetItems.filter((item) => item.status !== 'active');
      const pendingStylePacks = stylePacks.filter((item) => item.status !== 'active');
      const weather = profile.city ? await getCurrentWeather().catch(() => null) : null;

      this.setData({
        userName: profile.nickname || '时尚体验家',
        avatarUrl: wx.getStorageSync(LOCAL_AVATAR_KEY) || profile.avatarUrl || DEFAULT_AVATAR_URL,
        closetCount: closetItems.length,
        stylePackCount: activeStylePacks.length,
        tasks: buildDashboardTasks(pendingClosetItems, pendingStylePacks),
        todayRecommend: buildRecommendCard({
          activeClosetCount,
          activeStylePacks,
          weather,
          homeDailyRecommend
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
      content: '为了让首页问候和“我的”页展示更完整，建议先去完善头像和昵称。',
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
      wx.setStorageSync(CLOSET_PENDING_HIGHLIGHT_KEY, Date.now());
      wx.switchTab({ url: '/pages/closet/index' });
      return;
    }
    if (action === 'style-pack') {
      wx.navigateTo({ url: '/pages/style-pack/index?highlightPending=1' });
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

  handleTodaySecondaryAction() {
    const todayRecommend = this.data.todayRecommend || {};
    if (todayRecommend.secondaryAction === 'detail' && todayRecommend.recommendationId) {
      wx.navigateTo({
        url: `/pages/recommend/result?id=${todayRecommend.recommendationId}`
      });
      return;
    }
    this.goRecommend();
  },

  handleTodayCardTap() {
    const todayRecommend = this.data.todayRecommend || {};
    if (todayRecommend.recommendationId) {
      wx.navigateTo({
        url: `/pages/recommend/result?id=${todayRecommend.recommendationId}`
      });
      return;
    }
    wx.navigateTo({ url: '/pages/recommend/config' });
  },

  handleTodayPrimaryAction() {
    const todayRecommend = this.data.todayRecommend || {};
    if (todayRecommend.primaryAction === 'recommend') {
      this.goRecommend();
      return;
    }
    this.generateTodayRecommendation();
  },

  async generateTodayRecommendation() {
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

      this.setData({ generatingTodayCanvas: false });
      wx.navigateTo({
        url: `/pages/recommend/result?id=${generateResult.recommendationId}`
      });
    } catch (error) {
      console.error('Generate daily recommendation failed', error);
      this.setData({ generatingTodayCanvas: false });
      wx.showToast({
        title: mapDailyRecommendationError(error),
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

function buildDashboardTasks(pendingClosetItems, pendingStylePacks) {
  const tasks = [];
  const pendingClosetCount = (pendingClosetItems || []).length;
  const pendingStylePackCount = (pendingStylePacks || []).length;

  if (pendingClosetCount > 0) {
    const previewTitles = pendingClosetItems
      .slice(0, 3)
      .map((item) => formatPendingName(item.title || item.subCategory || item.category));
    const remainingCount = Math.max(pendingClosetCount - previewTitles.length, 0);

    tasks.push({
      id: 'closet-pending',
      type: 'upload',
      title: `${pendingClosetCount} 件单品待确认`,
      detail: previewTitles.join('、'),
      moreText: remainingCount > 0 ? `等 ${remainingCount} 件` : '',
      action: 'closet'
    });
  }

  if (pendingStylePackCount > 0) {
    const previewNames = pendingStylePacks
      .slice(0, 2)
      .map((item) => formatPendingName(item.name || item.title || '风格包'));
    const remainingCount = Math.max(pendingStylePackCount - previewNames.length, 0);

    tasks.push({
      id: 'style-pending',
      type: 'style',
      title: `${pendingStylePackCount} 个风格包待生效`,
      detail: previewNames.join('、'),
      moreText: remainingCount > 0 ? `等 ${remainingCount} 个` : '',
      action: 'style-pack'
    });
  }

  return tasks;
}

function formatPendingName(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '未命名';
  }
  return text.length > 10 ? `${text.slice(0, 10)}…` : text;
}

function buildRecommendCard({
  activeClosetCount,
  activeStylePacks,
  weather,
  homeDailyRecommend
}) {
  if (homeDailyRecommend && homeDailyRecommend.status && homeDailyRecommend.status !== 'empty') {
    return buildHomeDailyRecommendCard({
      weather,
      stylePackId: activeStylePacks[0]?.stylePackId || '',
      homeDailyRecommend
    });
  }

  return buildFallbackRecommendCard({
    activeClosetCount,
    activeStylePacks,
    weather
  });
}

function buildHomeDailyRecommendCard({ weather, stylePackId, homeDailyRecommend }) {
  const weatherPayload = weather
    ? {
        temperature: Math.round(weather.temperature),
        condition: weather.condition
      }
    : null;
  const weatherText = weather
    ? `${weather.city} · ${weather.condition} ${Math.round(weather.temperature)}°C`
    : '根据你的喜欢与收藏生成';
  const isProcessing = homeDailyRecommend.status === 'processing';

  return {
    title: '今日推荐',
    scene: homeDailyRecommend.scene || '通勤',
    weather: weatherText,
    reason:
      homeDailyRecommend.reason ||
      (isProcessing
        ? '正在根据你最近喜欢和收藏的搭配生成今日推荐。'
        : '这是根据你最近喜欢和收藏整理出的今日搭配。'),
    image: homeDailyRecommend.coverImageUrl || '',
    canGenerate: false,
    weatherPayload,
    stylePackId,
    recommendationId: homeDailyRecommend.recommendationId || '',
    mode: 'homeDaily',
    secondaryAction: homeDailyRecommend.recommendationId ? 'detail' : 'recommend',
    secondaryLabel: homeDailyRecommend.recommendationId ? '查看今日推荐' : '查看推荐页',
    primaryAction: 'recommend',
    primaryLabel: '不喜欢，去推荐页'
  };
}

function buildFallbackRecommendCard({ activeClosetCount, activeStylePacks, weather }) {
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
      stylePackId: activeStylePacks[0]?.stylePackId || '',
      recommendationId: '',
      mode: 'fallback',
      secondaryAction: 'recommend',
      secondaryLabel: '查看推荐页',
      primaryAction: 'generate',
      primaryLabel: '先补齐衣橱'
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
      stylePackId: '',
      recommendationId: '',
      mode: 'fallback',
      secondaryAction: 'recommend',
      secondaryLabel: '查看推荐页',
      primaryAction: 'generate',
      primaryLabel: '生成推荐结果'
    };
  }

  return {
    title: '今日推荐',
    scene,
    weather: weatherText,
    reason: weather
      ? `当前 ${weather.condition} ${Math.round(weather.temperature)}°C，衣橱和风格包都已准备好，可以先生成推荐结果再决定要不要同步到画布。`
      : '衣橱和风格包都已准备好，可以先生成推荐结果再决定要不要同步到画布。',
    image: '',
    canGenerate: true,
    weatherPayload,
    stylePackId: activeStylePacks[0]?.stylePackId || '',
    recommendationId: '',
    mode: 'fallback',
    secondaryAction: 'recommend',
    secondaryLabel: '查看推荐页',
    primaryAction: 'generate',
    primaryLabel: '生成推荐结果'
  };
}

function mapDailyRecommendationError(error) {
  const message = error?.error?.message || error?.message || '';
  if (!message) {
    return '生成推荐失败';
  }
  if (message.includes('No available wardrobe candidates were found')) {
    return '先确认并入库至少 2 件单品';
  }
  if (message.includes('每天最多 3 次') || message.includes('今日灵感图集生成次数已用完')) {
    return '今日生成次数已用完，明天再来试试';
  }
  return message;
}
