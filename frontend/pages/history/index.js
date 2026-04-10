Page({
  data: {
    tabs: ['收藏的搭�?, '生成历史'],
    activeTab: 0,
    records: [
      {
        id: 'r1',
        date: '2026-04-09',
        scene: '约会',
        mainImg: 'https://dummyimage.com/300x500/E5E7EB/1C1C1E?text=Look+1'
      },
      {
        id: 'r2',
        date: '2026-04-05',
        scene: '通勤',
        mainImg: 'https://dummyimage.com/300x500/E5E7EB/1C1C1E?text=Look+2'
      }
    ]
  },

  switchTab(e) {
    this.setData({ activeTab: e.currentTarget.dataset.index });
  }
});
