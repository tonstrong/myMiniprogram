import api from '../../utils/api';

Page({
  data: {
    userName: '时尚体验官',
    greeting: '你好',
    currentDateText: '',
    tasks: [],
    closetCount: 0,
    stylePackCount: 0,
    todayRecommend: {
      scene: '今日建议',
      weather: '以当前衣橱为准',
      reason: '先补齐衣橱与风格包，AI 才能生成更准确的推荐。',
      image: 'https://dummyimage.com/300x400/F3F4F6/1C1C1E&text=Outfit'
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

      const closetItems = closetRes.items || [];
      const stylePacks = stylePackRes.items || [];
      const pendingClosetCount = closetItems.filter(item => item.status !== 'active').length;
      const pendingStylePackCount = stylePacks.filter(item => item.status !== 'active').length;
      const activeClosetCount = closetItems.filter(item => item.status === 'active').length;
      const activeStylePackCount = stylePacks.filter(item => item.status === 'active').length;

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

      this.setData({
        userName: profile.nickname || '时尚体验官',
        closetCount: closetItems.length,
        stylePackCount: activeStylePackCount,
        tasks,
        todayRecommend: buildRecommendCard(activeClosetCount, activeStylePackCount)
      });
    } catch (error) {
      console.error('Load home dashboard failed', error);
      wx.showToast({ title: '首页加载失败', icon: 'none' });
    }
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
  }
});

function buildRecommendCard(activeClosetCount, activeStylePackCount) {
  if (activeClosetCount < 2) {
    return {
      scene: '开始生成推荐',
      weather: `已入库 ${activeClosetCount} 件单品`,
      reason: '至少需要 2 件已入库单品，先去确认更多衣橱内容吧。',
      image: 'https://dummyimage.com/300x400/F3F4F6/1C1C1E&text=Closet'
    };
  }

  if (activeStylePackCount === 0) {
    return {
      scene: '开始生成推荐',
      weather: `已入库 ${activeClosetCount} 件单品`,
      reason: '你已经具备基础推荐条件，再激活一个风格包会让推荐结果更贴近你的偏好。',
      image: 'https://dummyimage.com/300x400/F3F4F6/1C1C1E&text=Style+Pack'
    };
  }

  return {
    scene: '开始生成推荐',
    weather: `已激活 ${activeStylePackCount} 个风格包`,
    reason: '衣橱和风格包都已准备好，可以直接进入推荐页生成新的搭配方案。',
    image: 'https://dummyimage.com/300x400/F3F4F6/1C1C1E&text=Recommend'
  };
}
