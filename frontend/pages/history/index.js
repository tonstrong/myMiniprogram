import api from '../../utils/api';
import { resolveImageUrl } from '../../utils/image-url';

Page({
  data: {
    tabs: ['收藏的搭配', '生成历史'],
    activeTab: 0,
    records: [],
    groupedRecords: [],
    backendReady: true,
    backendMessage: '',
    loading: false,
    refreshing: false,
    noMore: false,
    pageNo: 1,
    pageSize: 20,
    total: 0
  },

  onShow() {
    this.loadRecords(true);
  },

  onPullDownRefresh() {
    this.setData({ refreshing: true });
    this.loadRecords(true);
  },

  async loadRecords(reset = false) {
    if (this.data.loading && !reset) {
      return;
    }

    const pageNo = reset ? 1 : this.data.pageNo;
    this.setData({ loading: true });
    try {
      const savedOnly = this.data.activeTab === 0 ? 1 : 0;
      const res = await api.request({
        url: `/api/recommendations?savedOnly=${savedOnly}&pageNo=${pageNo}&pageSize=${this.data.pageSize}`,
        method: 'GET'
      });

      const records = await Promise.all((res.items || []).map(async (item) => ({
        id: item.recommendationId,
        scene: item.scene,
        status: item.status,
        date: formatDate(item.createdAt),
        createdAtRaw: item.createdAt,
        coverImageUrl: await resolveImageUrl(item.coverImageUrl),
        isSaved: item.status === 'saved'
      })));

      this.setData({
        backendReady: true,
        backendMessage: '',
        records: reset ? records : [...this.data.records, ...records],
        groupedRecords: buildGroups(reset ? records : [...this.data.records, ...records]),
        pageNo: pageNo + 1,
        total: res.total || records.length,
        noMore: (reset ? records.length : this.data.records.length + records.length) >= (res.total || records.length),
        loading: false,
        refreshing: false
      });
      wx.stopPullDownRefresh();
    } catch (error) {
      console.error('Load recommendation history failed', error);
      this.setData({
        backendReady: false,
        backendMessage: '历史记录加载失败，请稍后再试。',
        records: reset ? [] : this.data.records,
        groupedRecords: reset ? [] : this.data.groupedRecords,
        loading: false,
        refreshing: false
      });
      wx.stopPullDownRefresh();
    }
  },

  switchTab(e) {
    const activeTab = e.currentTarget.dataset.index;
    this.setData({ activeTab, pageNo: 1, total: 0, records: [], groupedRecords: [], noMore: false });
    this.loadRecords(true);
  },

  onReachBottom() {
    if (this.data.loading || this.data.noMore || this.data.records.length >= this.data.total) {
      return;
    }
    this.loadRecords(false);
  },

  openRecommendation(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/recommend/result?id=${id}` });
  },

  goRecommend() {
    wx.navigateTo({ url: '/pages/recommend/config' });
  }
});

function formatDate(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${month}/${day}`;
}

function buildGroups(records) {
  const groups = {
    today: [],
    yesterday: [],
    earlier: []
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  records.forEach((record) => {
    const timestamp = parseRecordTimestamp(record.date, record.createdAtRaw);
    if (timestamp >= todayStart) {
      groups.today.push(record);
      return;
    }
    if (timestamp >= yesterdayStart) {
      groups.yesterday.push(record);
      return;
    }
    groups.earlier.push(record);
  });

  return [
    { key: 'today', title: '今天', items: groups.today },
    { key: 'yesterday', title: '昨天', items: groups.yesterday },
    { key: 'earlier', title: '更早', items: groups.earlier }
  ].filter(group => group.items.length > 0);
}

function parseRecordTimestamp(_dateText, createdAtRaw) {
  const parsed = createdAtRaw ? new Date(createdAtRaw).getTime() : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}
