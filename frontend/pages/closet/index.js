import api from '../../utils/api';

Page({
  data: {
    filters: [
      { label: '全部', value: '' },
      { label: '上衣', value: '上衣' },
      { label: '下装', value: '下装' },
      { label: '外套', value: '外套' },
      { label: '鞋履', value: '鞋履' },
      { label: '包袋', value: '包袋' },
      { label: '饰品', value: '配饰' }
    ],
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
      const activeFilter = this.data.filters[this.data.activeFilter];
      const categoryFilter = activeFilter?.value || '';
      const res = await api.request({
        url: `/api/closet/items${categoryFilter ? '?category=' + encodeURIComponent(categoryFilter) : ''}`,
        method: 'GET'
      });

      const items = (res.items || [])
        .filter(item => item.status !== 'deleted')
        .map(item => ({
        id: item.itemId,
        img: item.imageOriginalUrl || '',
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
