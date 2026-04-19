import api from '../../utils/api';
import { resolveImageUrl } from '../../utils/image-url';

const HOME_PENDING_HIGHLIGHT_KEY = 'closet:highlightPendingFromHome';
const PAGE_SIZE = 10;

Page({
  data: {
    filters: [
      { label: '全部', value: '' },
      { label: '上衣', value: '上衣' },
      { label: '下装', value: '下装' },
      { label: '外套', value: '外套' },
      { label: '鞋履', value: '鞋履' },
      { label: '包袋', value: '包袋' },
      { label: '配饰', value: '配饰' }
    ],
    activeFilter: 0,
    items: [],
    loading: true,
    loadingMore: false,
    pageNo: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    hasMore: true,
    highlightPending: false,
    pendingCount: 0
  },

  onLoad() {
    this.consumePendingHighlightFlag();
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.consumePendingHighlightFlag();
    this.fetchItems({ reset: true });
  },

  onReachBottom() {
    if (!this.data.loading && !this.data.loadingMore && this.data.hasMore) {
      this.fetchItems({ reset: false });
    }
  },

  consumePendingHighlightFlag() {
    const highlightPending = !!wx.getStorageSync(HOME_PENDING_HIGHLIGHT_KEY);
    if (highlightPending) {
      wx.removeStorageSync(HOME_PENDING_HIGHLIGHT_KEY);
    }
    this.setData({ highlightPending });
  },

  async fetchItems({ reset = true } = {}) {
    const pageNo = reset ? 1 : this.data.pageNo + 1;
    this.setData(reset ? { loading: true, pageNo: 1, hasMore: true } : { loadingMore: true });
    try {
      const activeFilter = this.data.filters[this.data.activeFilter];
      const categoryFilter = activeFilter?.value || '';
      const query = [
        `pageNo=${pageNo}`,
        `pageSize=${this.data.pageSize}`,
        categoryFilter ? `category=${encodeURIComponent(categoryFilter)}` : ''
      ].filter(Boolean).join('&');
      const res = await api.request({
        url: `/api/closet/items?${query}`,
        method: 'GET'
      });

      const items = await Promise.all(
        (res.items || [])
          .filter((item) => item.status !== 'deleted')
          .map(async (item) => ({
            id: item.itemId,
            img: await resolveImageUrl(item.imageOriginalUrl || ''),
            title: [item.category, item.subCategory].filter(Boolean).join(' / ') || '待补充信息单品',
            tags: item.tags || [],
            status: item.status,
            isPending: item.status !== 'active'
          }))
      );

      const nextItems = reset ? items : [...this.data.items, ...items];
      const pendingCount = nextItems.filter((item) => item.isPending).length;
      const sortedItems = this.data.highlightPending
        ? [...nextItems].sort((left, right) => Number(right.isPending) - Number(left.isPending))
        : nextItems;
      const total = Number(res.total || sortedItems.length);

      this.setData({
        items: sortedItems,
        pendingCount,
        total,
        pageNo,
        hasMore: sortedItems.length < total,
        loading: false,
        loadingMore: false
      });
    } catch (error) {
      console.error('Failed to fetch items', error);
      this.setData({ loading: false, loadingMore: false });
    }
  },

  switchFilter(e) {
    const idx = Number(e.currentTarget.dataset.index || 0);
    this.setData({ activeFilter: idx });
    this.fetchItems({ reset: true });
  },

  goUpload() {
    wx.navigateTo({ url: '/pages/closet/upload' });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/closet/detail?id=${id}` });
  }
});
