import api from '../../utils/api';

const CATEGORY_OPTIONS = ['上衣', '下装', '外套', '连衣裙', '鞋履', '包袋', '配饰'];
const FIT_OPTIONS = ['宽松', '修身', '直筒', '短款', '超长'];
const COLOR_OPTIONS = ['白色', '黑色', '灰色', '蓝色', '卡其色', '米色', '红色', '粉色', '黄色', '绿色', '紫色', '棕色', '多色'];
const SEASON_OPTIONS = ['春', '夏', '秋', '冬'];
const TAG_OPTIONS = ['极简', '通勤', '基础款', '休闲', '百搭'];

Page({
  data: {
    itemId: '',
    isNew: false,
    taskId: '',
    previewImage: '',
    CATEGORY_OPTIONS,
    FIT_OPTIONS,
    COLOR_OPTIONS,
    item: {
      img: '',
      category: '',
      subCategory: '',
      color: '',
      material: '',
      fit: '',
      seasons: [],
      tags: []
    }
  },

  onLoad(options) {
    const isNew = options.isNew === '1';
    this.setData({
      itemId: options.id || '',
      isNew,
      taskId: options.taskId || '',
      previewImage: options.preview ? decodeURIComponent(options.preview) : ''
    });
    wx.setNavigationBarTitle({ title: isNew ? '确认单品' : '单品详情' });
  },

  onShow() {
    if (this.data.itemId) {
      this.fetchDetail();
    }
  },

  async fetchDetail() {
    try {
      const detail = await api.request({
        url: `/api/closet/items/${this.data.itemId}`,
        method: 'GET'
      });
      this.setData({ item: mapItemDetail(detail, this.data.previewImage) });
    } catch (error) {
      console.error('Fetch closet detail failed', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  bindCategoryChange(e) {
    this.setData({ 'item.category': CATEGORY_OPTIONS[e.detail.value] });
  },

  bindFitChange(e) {
    this.setData({ 'item.fit': FIT_OPTIONS[e.detail.value] });
  },

  bindColorChange(e) {
    this.setData({ 'item.color': COLOR_OPTIONS[e.detail.value] });
  },

  editField(e) {
    const field = e.currentTarget.dataset.field;
    switch (field) {
      case '季节':
        return this.pickMultiple('seasons', SEASON_OPTIONS, '适用季节');
      case '风格':
        return this.pickMultiple('tags', TAG_OPTIONS, '风格标签');
      default:
        wx.showToast({ title: `暂不支持编辑${field}`, icon: 'none' });
    }
  },

  addCustomTag() {
    wx.showModal({
      title: '添加自定义标签',
      editable: true,
      placeholderText: '请输入标签名称',
      success: (res) => {
        if (res.confirm && res.content) {
          const tag = res.content.trim();
          if (tag && !this.data.item.tags.includes(tag)) {
            this.setData({
              'item.tags': [...this.data.item.tags, tag]
            });
          }
        }
      }
    });
  },

  pickSingle(key, options) {
    wx.showActionSheet({
      itemList: options,
      success: ({ tapIndex }) => {
        const next = { ...this.data.item, [key]: options[tapIndex] };
        this.setData({ item: next });
      }
    });
  },

  pickMultiple(key, options, title) {
    const selected = this.data.item[key] || [];
    wx.showActionSheet({
      alertText: `${title}（当前：${selected.join('、') || '未选择'}）`,
      itemList: options.map(option => `${selected.includes(option) ? '✓ ' : ''}${option}`),
      success: ({ tapIndex }) => {
        const value = options[tapIndex];
        const nextValues = selected.includes(value)
          ? selected.filter(item => item !== value)
          : [...selected, value];
        this.setData({ item: { ...this.data.item, [key]: nextValues } });
      }
    });
  },

  async confirmItem() {
    const updatePayload = buildUpdatePayload(this.data.item);
    if (!updatePayload.category || !updatePayload.colors?.length || !updatePayload.seasons?.length) {
      wx.showToast({ title: '请至少补全类别、颜色、季节', icon: 'none' });
      return;
    }

    wx.showLoading({ title: this.data.isNew ? '确认中...' : '保存中...' });
    try {
      await api.request({
        url: `/api/closet/items/${this.data.itemId}`,
        method: 'PUT',
        data: updatePayload
      });

      if (this.data.isNew) {
        await api.request({
          url: `/api/closet/items/${this.data.itemId}/confirm`,
          method: 'POST',
          data: {}
        });
      }

      wx.hideLoading();
      wx.showToast({ title: this.data.isNew ? '已入库' : '保存成功', icon: 'success' });
      setTimeout(() => {
        wx.switchTab({ url: '/pages/closet/index' });
      }, 800);
    } catch (error) {
      wx.hideLoading();
      console.error('Confirm or save closet item failed', error);
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  deleteItem() {
    wx.showModal({
      title: '确认删除',
      content: '删除后此单品将不再出现在智能推荐中。',
      confirmColor: '#FF3B30',
      success: async (res) => {
        if (!res.confirm) {
          return;
        }
        try {
          await api.request({
            url: `/api/closet/items/${this.data.itemId}`,
            method: 'DELETE'
          });
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => {
            wx.switchTab({ url: '/pages/closet/index' });
          }, 600);
        } catch (error) {
          console.error('Delete closet item failed', error);
          wx.showToast({ title: '删除失败', icon: 'none' });
        }
      }
    });
  }
});

function mapItemDetail(detail, previewImage = '') {
  const attributes = detail.attributes || {};
  return {
    img: normalizeImageUrl(detail.imageOriginalUrl) || previewImage || '',
    category: attributes.category || '',
    subCategory: attributes.subCategory || '',
    color: (attributes.colors || [])[0] || '',
    material: attributes.material || '',
    fit: (attributes.fit || [])[0] || '',
    seasons: attributes.seasons || [],
    tags: attributes.tags || []
  };
}

function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }

  if (
    url.startsWith('file://') ||
    url.startsWith('wxfile://') ||
    url.startsWith('http://tmp/') ||
    url.startsWith('https://tmp/')
  ) {
    return '';
  }

  return url;
}

function buildUpdatePayload(item) {
  return {
    category: item.category || undefined,
    subCategory: item.subCategory || undefined,
    colors: item.color ? [item.color] : [],
    material: item.material || undefined,
    fit: item.fit ? [item.fit] : [],
    seasons: item.seasons || [],
    tags: item.tags || []
  };
}
