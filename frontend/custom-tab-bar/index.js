Component({
  data: {
    selected: 0,
    list: [
      {
        pagePath: "/pages/home/index",
        text: "首页",
        iconCls: "icon-home"
      },
      {
        pagePath: "/pages/closet/index",
        text: "衣橱",
        iconCls: "icon-closet"
      },
      {
        pagePath: "/pages/profile/index",
        text: "我的",
        iconCls: "icon-profile"
      }
    ]
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({ url });
    }
  }
});
