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
      // Replace with backend data. Assuming lists are in res.items or res (array)
      this.setData({ items: res.items || res || [], loading: false });
    } catch (e) {
      console.error('Failed to fetch items', e);
      this.setData({ loading: false });
      // Fallback for visual mock when backend is missing
      this.setData({
        items: [
          { id: 'i1', img: 'https://dummyimage.com/300x400/E5E7EB/1C1C1E?text=White+Shirt', title: '极简白衬�?, tags: ['�?, '通勤'] },
          { id: 'i2', img: 'https://dummyimage.com/300x300/E5E7EB/1C1C1E?text=Black+Pants', title: '垂坠直筒西裤', tags: ['四季', '通勤'] }
        ]
      });
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
