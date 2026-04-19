import api from '../../utils/api';

Page({
  data: {
    packs: [],
    activePacks: [],
    pendingPacks: [],
    highlightPending: false,
    loading: false,
    pageNo: 1,
    pageSize: 10,
    total: 0,
    noMore: false
  },

  onLoad(options) {
    this.setData({
      highlightPending: options?.highlightPending === '1'
    });
  },

  onShow() {
    this.fetchPacks(true);
  },

  onReachBottom() {
    if (this.data.loading || this.data.noMore) {
      return;
    }
    this.fetchPacks(false);
  },

  async fetchPacks(reset = true) {
    const pageNo = reset ? 1 : this.data.pageNo;
    this.setData({ loading: true });

    try {
      const res = await api.request({
        url: `/api/style-packs?pageNo=${pageNo}&pageSize=${this.data.pageSize}`,
        method: 'GET'
      });

      const nextRecords = (res.items || []).map(item => ({
        id: item.stylePackId,
        name: item.name,
        source: item.sourceType,
        summary: `${item.status === 'active' ? '已生效' : '待确认'} · 版本 ${item.version || 1}`,
        status: item.status
      }));
      const records = reset ? nextRecords : [...this.data.packs, ...nextRecords];
      const total = typeof res.total === 'number' ? res.total : records.length;

      this.setData({
        packs: records,
        activePacks: records.filter(item => item.status === 'active'),
        pendingPacks: records.filter(item => item.status !== 'active'),
        pageNo: pageNo + 1,
        total,
        noMore: records.length >= total,
        loading: false
      });
    } catch (error) {
      console.error('Fetch style packs failed', error);
      this.setData({ loading: false });
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  goImport() {
    wx.navigateTo({ url: '/pages/style-pack/import' });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/style-pack/detail?id=${id}` });
  }
});
