import api from '../../utils/api';
import { resolveImageUrl } from '../../utils/image-url';

Page({
  data: {
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

  onLoad() {
    wx.setNavigationBarTitle({ title: '我的收藏' });
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
      const res = await api.request({
        url: `/api/recommendations?savedOnly=1&pageNo=${pageNo}&pageSize=${this.data.pageSize}`,
        method: 'GET'
      });

      const nextRecords = await Promise.all(
        (res.items || []).map(async (item) => ({
          id: item.recommendationId,
          scene: item.scene,
          status: item.status,
          date: formatDate(item.createdAt),
          createdAtRaw: item.createdAt,
          coverImageUrl: await resolveImageUrl(item.coverImageUrl),
          isSaved: item.status === 'saved'
        }))
      );

      const mergedRecords = reset ? nextRecords : [...this.data.records, ...nextRecords];
      const total = res.total || mergedRecords.length;

      this.setData({
        backendReady: true,
        backendMessage: '',
        records: mergedRecords,
        groupedRecords: buildGroups(mergedRecords),
        pageNo: pageNo + 1,
        total,
        noMore: mergedRecords.length >= total,
        loading: false,
        refreshing: false
      });
      wx.stopPullDownRefresh();
    } catch (error) {
      console.error('Load favorites failed', error);
      this.setData({
        backendReady: false,
        backendMessage: '收藏搭配加载失败，请稍后再试。',
        records: reset ? [] : this.data.records,
        groupedRecords: reset ? [] : this.data.groupedRecords,
        loading: false,
        refreshing: false
      });
      wx.stopPullDownRefresh();
    }
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
    const timestamp = parseRecordTimestamp(record.createdAtRaw);
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
  ].filter((group) => group.items.length > 0);
}

function parseRecordTimestamp(createdAtRaw) {
  const parsed = createdAtRaw ? new Date(createdAtRaw).getTime() : NaN;
  return Number.isNaN(parsed) ? 0 : parsed;
}
