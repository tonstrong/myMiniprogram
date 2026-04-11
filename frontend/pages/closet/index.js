import api from '../../utils/api';

Page({
  data: {
    filters: ['全部', '上衣', '下装', '外套', '鞋包'],
    activeFilter: 0,
    items: [],
    loading: true
  },

  onShow() {
    this.fetchItems();
  },

  async fetchItems() {
    this.setData({ loading: true });
    try {
      const categoryFilter = this.data.activeFilter === 0 ? '' : this.data.filters[this.data.activeFilter];
      const res = await api.request({
        url: `/api/closet/items${categoryFilter ? '?category=' + encodeURIComponent(categoryFilter) : ''}`,
        method: 'GET'
      });

      const items = (res.items || []).map(item => ({
        id: item.itemId,
        img: item.imageOriginalUrl || 'https://dummyimage.com/300x400/E5E7EB/1C1C1E&text=Closet+Item',
        title: [item.category, item.subCategory].filter(Boolean).join(' / ') || '待补充信息单品',
        tags: item.tags || []
      }));

      this.setData({ items, loading: false });
    } catch (e) {
      console.error('Failed to fetch items', e);
      this.setData({ loading: false });
    }
  },

  switchFilter(e) {
    const idx = e.currentTarget.dataset.index;
    this.setData({ activeFilter: idx });
    this.fetchItems();
  },

  goUpload() {
    wx.navigateTo({ url: '/pages/closet/upload' });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/closet/detail?id=' + id });
  }
});
