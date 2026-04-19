import api from '../../utils/api';

const HOME_PENDING_HIGHLIGHT_KEY = 'closet:highlightPendingFromHome';

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
    this.fetchItems();
  },

  consumePendingHighlightFlag() {
    const highlightPending = !!wx.getStorageSync(HOME_PENDING_HIGHLIGHT_KEY);
    if (highlightPending) {
      wx.removeStorageSync(HOME_PENDING_HIGHLIGHT_KEY);
    }
    this.setData({ highlightPending });
  },

  async fetchItems() {
    this.setData({ loading: true });
    try {
      const activeFilter = this.data.filters[this.data.activeFilter];
      const categoryFilter = activeFilter?.value || '';
      const res = await api.request({
        url: `/api/closet/items${categoryFilter ? `?category=${encodeURIComponent(categoryFilter)}` : ''}`,
        method: 'GET'
      });

      const items = (res.items || [])
        .filter((item) => item.status !== 'deleted')
        .map((item) => ({
          id: item.itemId,
          img: item.imageOriginalUrl || '',
          title: [item.category, item.subCategory].filter(Boolean).join(' / ') || '待补充信息单品',
          tags: item.tags || [],
          status: item.status,
          isPending: item.status !== 'active'
        }));

      const pendingCount = items.filter((item) => item.isPending).length;
      const sortedItems = this.data.highlightPending
        ? [...items].sort((left, right) => Number(right.isPending) - Number(left.isPending))
        : items;

      this.setData({
        items: sortedItems,
        pendingCount,
        loading: false
      });
    } catch (error) {
      console.error('Failed to fetch items', error);
      this.setData({ loading: false });
    }
  },

  switchFilter(e) {
    const idx = Number(e.currentTarget.dataset.index || 0);
    this.setData({ activeFilter: idx });
    this.fetchItems();
  },

  goUpload() {
    wx.navigateTo({ url: '/pages/closet/upload' });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/closet/detail?id=${id}` });
  }
});
