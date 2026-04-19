import api from '../../utils/api';
import { resolveImageUrl } from '../../utils/image-url';

const CATEGORY_OPTIONS = ['上衣', '下装', '外套', '连衣裙', '鞋履', '包袋', '配饰'];
const ACCESSORY_SUBCATEGORY_OPTIONS = ['层搭装饰片', '腰饰', '披肩', '围巾', '帽子', '首饰', '其他配饰'];
const FIT_OPTIONS = ['宽松', '修身', '直筒', '短款', '超长'];
const SEASON_OPTIONS = ['春', '夏', '秋', '冬'];
const TAG_OPTIONS = ['极简', '通勤', '基础款', '休闲', '百搭', '甜酷', '优雅', '法式', '韩系', '复古', '时髦', '知性', '慵懒', '山系', '街头'];
const COLOR_PALETTE_OPTIONS = [
  { label: '白色', hex: '#F7F7F2' },
  { label: '米白色', hex: '#F1E9D8' },
  { label: '黑色', hex: '#1C1C1E' },
  { label: '深灰色', hex: '#4B5563' },
  { label: '浅灰色', hex: '#D1D5DB' },
  { label: '米色', hex: '#D8C3A5' },
  { label: '卡其色', hex: '#B89968' },
  { label: '棕色', hex: '#7A5230' },
  { label: '咖啡色', hex: '#5B3A29' },
  { label: '浅蓝色', hex: '#A9CFF4' },
  { label: '牛仔蓝', hex: '#5F86C2' },
  { label: '深蓝色', hex: '#355C9A' },
  { label: '藏蓝色', hex: '#213A6B' },
  { label: '绿色', hex: '#5F8D4E' },
  { label: '红色', hex: '#C94C4C' },
  { label: '粉色', hex: '#E8A0BF' },
  { label: '黄色', hex: '#E3B341' },
  { label: '紫色', hex: '#8B6FB3' },
  { label: '橙色', hex: '#E6893D' },
  { label: '多色', hex: 'linear-gradient(135deg,#F87171 0%,#FBBF24 35%,#60A5FA 70%,#34D399 100%)' }
];

Page({
  data: {
    itemId: '',
    isNew: false,
    itemStatus: '',
    requiresConfirmation: false,
    previewImage: '',
    aiExtracting: false,
    cutoutProcessing: false,
    hasAiResult: false,
    aiSummaryText: '还没触发 AI 识别，也可以直接手动填写',
    aiQuota: {
      usedCount: 0,
      dailyLimit: 3,
      remainingCount: 3,
      unlimited: false
    },
    CATEGORY_OPTIONS,
    FIT_OPTIONS,
    COLOR_PALETTE: buildColorPaletteState([]),
    item: {
      img: '',
      category: '',
      subCategory: '',
      colors: [],
      material: '',
      fit: '',
      seasons: [],
      tags: []
    },
    inputSheet: {
      visible: false,
      field: '',
      title: '',
      placeholder: '',
      value: '',
      confirmText: '保存',
      multiline: false
    },
    cutoutPreview: {
      visible: false,
      imagePath: '',
      imageBase64: '',
      contentType: 'image/png',
      filename: '',
      engineUsed: ''
    }
  },

  onLoad(options) {
    const isNew = options.isNew === '1';
    this.setData({
      itemId: options.id || '',
      isNew,
      previewImage: options.preview ? decodeURIComponent(options.preview) : '',
      cutoutProcessing: false,
      cutoutPreview: {
        visible: false,
        imagePath: '',
        imageBase64: '',
        contentType: 'image/png',
        filename: '',
        engineUsed: ''
      }
    });
    wx.setNavigationBarTitle({ title: isNew ? '确认单品' : '单品详情' });
  },

  onShow() {
    if (this.data.itemId) {
      this.fetchDetail();
    }
  },

  onUnload() {
    cleanupCutoutPreviewFile(this.data.cutoutPreview?.imagePath);
  },

  noop() {},

  async fetchDetail() {
    try {
      const detail = await api.request({
        url: `/api/closet/items/${this.data.itemId}`,
        method: 'GET'
      });
      const item = await mapItemDetail(detail, this.data.previewImage);
      this.setData({
        item,
        itemStatus: detail.status || '',
        requiresConfirmation: shouldConfirmAfterSave(detail.status, this.data.isNew),
        hasAiResult: hasAiResult(detail),
        aiSummaryText: buildAiSummary(detail),
        aiQuota: mapAiQuota(detail.aiQuota),
        COLOR_PALETTE: buildColorPaletteState(item.colors || [])
      });
    } catch (error) {
      console.error('Fetch closet detail failed', error);
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  async triggerAiExtract() {
    if (this.data.aiExtracting) {
      return;
    }

    this.setData({ aiExtracting: true });
    wx.showLoading({ title: '识别中...' });
    try {
      const detail = await api.request({
        url: `/api/closet/items/${this.data.itemId}/extract`,
        method: 'POST',
        data: {}
      });
      const item = await mapItemDetail(detail, this.data.previewImage);
      wx.hideLoading();
      this.setData({
        aiExtracting: false,
        item,
        itemStatus: detail.status || '',
        requiresConfirmation: shouldConfirmAfterSave(detail.status, this.data.isNew),
        hasAiResult: hasAiResult(detail),
        aiSummaryText: buildAiSummary(detail),
        aiQuota: mapAiQuota(detail.aiQuota),
        COLOR_PALETTE: buildColorPaletteState(item.colors || [])
      });
      wx.showToast({ title: 'AI 识别完成', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      this.setData({ aiExtracting: false });
      console.error('Extract clothing item failed', error);
      const message = error?.error?.message || error?.message || error?.errMsg || '';
      wx.showToast({
        title: mapExtractErrorMessage(message),
        icon: 'none'
      });
    }
  },

  async triggerCutoutPreview() {
    if (this.data.cutoutProcessing) {
      return;
    }

    const recognitionType = resolveCutoutRecognitionType(
      this.data.item?.category,
      this.data.item?.subCategory
    );
    if (!recognitionType) {
      wx.showToast({ title: '请先选择类别', icon: 'none' });
      return;
    }

    const activeItemId = this.data.itemId;
    this.setData({ cutoutProcessing: true });
    wx.showLoading({ title: '抠图中...' });
    try {
      const result = await this.requestCutoutPreview();
      if (!result || result.itemId !== activeItemId || this.data.itemId !== activeItemId) {
        wx.hideLoading();
        this.setData({ cutoutProcessing: false });
        return;
      }

      const imagePath = await writeBase64ImageToTempFile(
        result.previewImageBase64,
        result.previewContentType,
        result.previewFilename
      );
      if (this.data.itemId !== activeItemId) {
        cleanupCutoutPreviewFile(imagePath);
        wx.hideLoading();
        this.setData({ cutoutProcessing: false });
        return;
      }

      wx.hideLoading();
      this.setData({
        cutoutProcessing: false,
        cutoutPreview: {
          visible: true,
          imagePath,
          imageBase64: result.previewImageBase64,
          contentType: result.previewContentType,
          filename: result.previewFilename,
          engineUsed: result.engineUsed || 'auto'
        }
      });
    } catch (error) {
      wx.hideLoading();
      this.setData({ cutoutProcessing: false });
      console.error('Preview cutout failed', error);
      const message = error?.error?.message || error?.message || error?.errMsg || '';
      wx.showToast({
        title: message || '智能抠图失败',
        icon: 'none'
      });
    }
  },

  async requestCutoutPreview() {
    const payload = {
      recognitionType: resolveCutoutRecognitionType(
        this.data.item?.category,
        this.data.item?.subCategory
      ),
      engine: 'auto',
      keepCanvas: false,
      saveMask: false
    };

    try {
      return await api.request({
        url: `/api/closet/items/${this.data.itemId}/cutout-preview`,
        method: 'POST',
        data: payload
      });
    } catch (error) {
      const message = error?.error?.message || error?.message || error?.errMsg || '';
      if (!message.includes('Item image is not available for cutout')) {
        throw error;
      }

      const sourcePayload = await buildCutoutSourcePayload(
        this.data.item?.img || this.data.previewImage,
        this.data.itemId
      );
      if (!sourcePayload) {
        throw error;
      }

      return api.request({
        url: `/api/closet/items/${this.data.itemId}/cutout-preview`,
        method: 'POST',
        data: {
          ...payload,
          ...sourcePayload
        }
      });
    }
  },

  closeCutoutPreview() {
    const previewPath = this.data.cutoutPreview?.imagePath;
    this.setData({
      cutoutPreview: {
        ...this.data.cutoutPreview,
        visible: false,
        imagePath: '',
        imageBase64: '',
        contentType: 'image/png',
        filename: '',
        engineUsed: ''
      }
    }, () => {
      cleanupCutoutPreviewFile(previewPath);
    });
  },

  async confirmCutoutPreview() {
    const preview = this.data.cutoutPreview || {};
    if (!preview.imageBase64 || this.data.cutoutProcessing) {
      return;
    }

    this.setData({ cutoutProcessing: true });
    wx.showLoading({ title: '应用中...' });
    try {
      const detail = await api.request({
        url: `/api/closet/items/${this.data.itemId}/cutout-apply`,
        method: 'POST',
        data: {
          imageBase64: preview.imageBase64,
          contentType: preview.contentType || 'image/png',
          filename: preview.filename || 'cutout.png'
        }
      });

      const item = await mapItemDetail(detail, preview.imagePath || this.data.previewImage);
      wx.hideLoading();
      this.setData({
        cutoutProcessing: false,
        previewImage: item.img || '',
        item,
        cutoutPreview: {
          visible: false,
          imagePath: '',
          imageBase64: '',
          contentType: 'image/png',
          filename: '',
          engineUsed: ''
        }
      }, () => {
        cleanupCutoutPreviewFile(preview.imagePath);
      });
      wx.showToast({ title: '已使用抠图结果', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      this.setData({ cutoutProcessing: false });
      console.error('Apply cutout failed', error);
      wx.showToast({ title: '应用抠图失败', icon: 'none' });
    }
  },

  bindCategoryChange(e) {
    const category = CATEGORY_OPTIONS[e.detail.value];
    const nextItem = {
      ...this.data.item,
      category,
      subCategory:
        category === '配饰'
          ? this.data.item.subCategory || '层搭装饰片'
          : this.data.item.subCategory
    };
    this.setData({ item: nextItem });
  },

  bindFitChange(e) {
    this.setData({ 'item.fit': FIT_OPTIONS[e.detail.value] });
  },

  editField(e) {
    const field = e.currentTarget.dataset.field;
    switch (field) {
      case '子类':
        return this.editSubCategory();
      case '季节':
        return this.pickMultiple('seasons', SEASON_OPTIONS, '适用季节');
      case '风格':
        return this.pickMultiple('tags', TAG_OPTIONS, '风格标签');
      case '颜色':
        return this.openCustomColorInput();
      default:
        wx.showToast({ title: `暂不支持编辑${field}`, icon: 'none' });
    }
  },

  toggleColor(e) {
    const color = e.currentTarget.dataset.color;
    const selectedColors = this.data.item.colors || [];
    const nextColors = selectedColors.includes(color)
      ? selectedColors.filter((item) => item !== color)
      : [...selectedColors, color];
    this.setData({
      'item.colors': nextColors,
      COLOR_PALETTE: buildColorPaletteState(nextColors)
    });
  },

  openCustomColorInput() {
    wx.showModal({
      title: '添加自定义颜色',
      editable: true,
      placeholderText: '例如：雾霾蓝 / 奶油白 / 酒红色',
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        const color = (res.content || '').trim();
        if (!color) {
          return;
        }
        const nextColors = this.data.item.colors.includes(color)
          ? this.data.item.colors
          : [...this.data.item.colors, color];
        this.setData({
          'item.colors': nextColors,
          COLOR_PALETTE: buildColorPaletteState(nextColors)
        });
      }
    });
  },

  removeColor(e) {
    const color = e.currentTarget.dataset.color;
    const nextColors = (this.data.item.colors || []).filter((item) => item !== color);
    this.setData({
      'item.colors': nextColors,
      COLOR_PALETTE: buildColorPaletteState(nextColors)
    });
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

  editSubCategory() {
    if (this.data.item.category === '配饰') {
      wx.showActionSheet({
        itemList: ACCESSORY_SUBCATEGORY_OPTIONS,
        success: ({ tapIndex }) => {
          this.setData({ 'item.subCategory': ACCESSORY_SUBCATEGORY_OPTIONS[tapIndex] });
        },
        fail: () => {
          this.openSubCategoryInput();
        }
      });
      return;
    }

    this.openSubCategoryInput();
  },

  openSubCategoryInput() {
    this.openInputSheet({
      field: 'subCategory',
      title: '填写子类',
      placeholder: '请输入更细的单品类型',
      value: this.data.item.subCategory || '',
      confirmText: '保存子类',
      multiline: true
    });
  },

  openInputSheet({ field, title, placeholder, value = '', confirmText = '保存', multiline = false }) {
    this.setData({
      inputSheet: {
        visible: true,
        field,
        title,
        placeholder,
        value,
        confirmText,
        multiline
      }
    });
  },

  closeInputSheet() {
    this.setData({
      inputSheet: {
        ...this.data.inputSheet,
        visible: false
      }
    });
  },

  onInputSheetChange(e) {
    this.setData({
      'inputSheet.value': e.detail.value || ''
    });
  },

  submitInputSheet() {
    const { field, value } = this.data.inputSheet;
    const nextValue = String(value || '').trim();

    if (!nextValue) {
      wx.showToast({ title: '请先输入内容', icon: 'none' });
      return;
    }

    if (field === 'subCategory') {
      this.setData({
        'item.subCategory': nextValue
      });
    }

    this.closeInputSheet();
  },

  pickMultiple(key, options, title) {
    const selected = this.data.item[key] || [];
    wx.showActionSheet({
      alertText: `${title}（当前：${selected.join('、') || '未选择'}）`,
      itemList: options.map((option) => `${selected.includes(option) ? '✓ ' : ''}${option}`),
      success: ({ tapIndex }) => {
        const value = options[tapIndex];
        const nextValues = selected.includes(value)
          ? selected.filter((item) => item !== value)
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

    const shouldConfirm = this.data.requiresConfirmation;
    wx.showLoading({ title: shouldConfirm ? '确认中...' : '保存中...' });
    try {
      await api.request({
        url: `/api/closet/items/${this.data.itemId}`,
        method: 'PUT',
        data: updatePayload
      });

      if (shouldConfirm) {
        await api.request({
          url: `/api/closet/items/${this.data.itemId}/confirm`,
          method: 'POST',
          data: {}
        });
      }

      wx.hideLoading();
      this.setData({
        itemStatus: 'active',
        requiresConfirmation: false,
        isNew: false
      });
      wx.showToast({
        title: shouldConfirm ? '已确认入库' : '保存成功',
        icon: 'success'
      });
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

async function mapItemDetail(detail, previewImage = '') {
  const attributes = detail.attributes || {};
  return {
    img: await resolveDetailImageUrl(detail.imageOriginalUrl, previewImage),
    category: attributes.category || '',
    subCategory: attributes.subCategory || '',
    colors: attributes.colors || [],
    material: attributes.material || '',
    fit: (attributes.fit || [])[0] || '',
    seasons: attributes.seasons || [],
    tags: attributes.tags || []
  };
}

async function resolveDetailImageUrl(imageOriginalUrl, previewImage = '') {
  const normalized = normalizeImageUrl(imageOriginalUrl);
  if (!normalized) {
    return previewImage || '';
  }

  const resolved = await resolveImageUrl(normalized);
  return resolved || previewImage || '';
}

function hasAiResult(detail) {
  const attributes = detail.attributes || {};
  return Boolean(
    detail.llmMeta?.provider ||
      attributes.category ||
      (attributes.colors && attributes.colors.length) ||
      (attributes.tags && attributes.tags.length)
  );
}

function buildAiSummary(detail) {
  const provider = detail.llmMeta?.provider;
  if (provider) {
    return 'AI 已识别，可继续修改结果';
  }
  return '还没触发 AI 识别，也可以直接手动填写';
}

function mapAiQuota(aiQuota) {
  return {
    usedCount: Number(aiQuota?.usedCount || 0),
    dailyLimit: Number(aiQuota?.dailyLimit || 3),
    remainingCount:
      aiQuota?.remainingCount === null || aiQuota?.remainingCount === undefined
        ? null
        : Number(aiQuota.remainingCount),
    unlimited: Boolean(aiQuota?.unlimited)
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
    colors: item.colors || [],
    material: item.material || undefined,
    fit: item.fit ? [item.fit] : [],
    seasons: item.seasons || [],
    tags: item.tags || []
  };
}

function shouldConfirmAfterSave(status, isNew = false) {
  if (isNew) {
    return true;
  }
  return status === 'needs_review' || status === 'uploaded';
}

function buildColorPaletteState(selectedColors) {
  return COLOR_PALETTE_OPTIONS.map((option) => ({
    ...option,
    selected: selectedColors.includes(option.label),
    swatchStyle:
      option.hex.indexOf('linear-gradient') === 0
        ? `background:${option.hex};`
        : `background-color:${option.hex};`
  }));
}

function mapExtractErrorMessage(message) {
  if (!message) {
    return 'AI 识别失败，请稍后再试';
  }

  if (
    message.includes('每天最多 3 次') ||
    message.includes('今日 AI 识别次数已用完')
  ) {
    return '今日 AI 识别次数已用完';
  }

  if (message.includes('Item image is not available')) {
    return '当前图片暂不支持 AI 识别';
  }

  return message;
}

function writeBase64ImageToTempFile(base64, contentType = 'image/png', filename = 'cutout.png') {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager();
    const extension = inferImageExtension(contentType, filename);
    const tempPath = `${wx.env.USER_DATA_PATH}/${buildCutoutPreviewTempFilename(filename, extension)}`;
    const normalizedBase64 = String(base64 || '').replace(/^data:[^;]+;base64,/, '');
    const buffer = wx.base64ToArrayBuffer(normalizedBase64);

    clearOldCutoutPreviewFiles(fs).then(() => {
      writePreviewFile(fs, tempPath, buffer, resolve, reject);
    });
  });
}

function buildCutoutPreviewTempFilename(filename, extension) {
  const safeBaseName = String(filename || 'preview')
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 48) || 'preview';
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `cutout-${safeBaseName}-${nonce}${extension}`;
}

function writePreviewFile(fs, filePath, buffer, resolve, reject) {
  fs.writeFile({
    filePath,
    data: buffer,
    success: () => resolve(filePath),
    fail: (error) => {
      if (error?.errMsg?.includes('the maximum size of the file storage limit is exceeded')) {
        clearOldCutoutPreviewFiles(fs)
          .then(() => {
            fs.writeFile({
              filePath,
              data: buffer,
              success: () => resolve(filePath),
              fail: reject
            });
          })
          .catch(() => reject(error));
        return;
      }
      reject(error);
    }
  });
}

function clearOldCutoutPreviewFiles(fs) {
  return new Promise((resolve) => {
    fs.readdir({
      dirPath: wx.env.USER_DATA_PATH,
      success: (res) => {
        const targets = (res.files || []).filter((name) => /^cutout-.*\.(png|jpg|jpeg|webp)$/i.test(name));
        if (targets.length === 0) {
          resolve();
          return;
        }

        let pending = targets.length;
        targets.forEach((name) => {
          fs.unlink({
            filePath: `${wx.env.USER_DATA_PATH}/${name}`,
            complete: () => {
              pending -= 1;
              if (pending === 0) {
                resolve();
              }
            }
          });
        });
      },
      fail: () => resolve()
    });
  });
}

function cleanupCutoutPreviewFile(filePath) {
  if (!filePath || !filePath.startsWith(wx.env.USER_DATA_PATH)) {
    return;
  }

  wx.getFileSystemManager().unlink({
    filePath,
    fail: () => {}
  });
}

async function buildCutoutSourcePayload(imageUrl, itemId) {
  const localFilePath = await ensureLocalImagePath(imageUrl);
  if (!localFilePath) {
    return null;
  }

  try {
    const fileContentBase64 = await readFileAsBase64(localFilePath);
    return {
      sourceImageBase64: fileContentBase64,
      sourceContentType: inferImageContentType(localFilePath),
      sourceFilename: `${itemId || 'cutout-source'}${inferImageExtension('', localFilePath)}`
    };
  } finally {
    cleanupDownloadedSourceImage(localFilePath, imageUrl);
  }
}

function ensureLocalImagePath(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return Promise.resolve('');
  }

  if (
    imageUrl.startsWith(wx.env.USER_DATA_PATH) ||
    imageUrl.startsWith('wxfile://') ||
    imageUrl.startsWith('http://tmp/') ||
    imageUrl.startsWith('https://tmp/')
  ) {
    return Promise.resolve(imageUrl);
  }

  return new Promise((resolve) => {
    wx.downloadFile({
      url: imageUrl,
      success: (res) => resolve(res.tempFilePath || ''),
      fail: () => resolve('')
    });
  });
}

function readFileAsBase64(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (res) => resolve(res.data),
      fail: reject
    });
  });
}

function inferImageContentType(filePath = '') {
  const lower = String(filePath || '').toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}

function cleanupDownloadedSourceImage(filePath, originalUrl) {
  if (!filePath || filePath === originalUrl) {
    return;
  }

  if (!filePath.startsWith(wx.env.USER_DATA_PATH) && !filePath.startsWith('wxfile://')) {
    return;
  }

  wx.getFileSystemManager().unlink({
    filePath,
    fail: () => {}
  });
}

function inferImageExtension(contentType, filename = '') {
  if (filename && /\.[a-zA-Z0-9]+$/.test(filename)) {
    return filename.slice(filename.lastIndexOf('.'));
  }
  if (contentType === 'image/webp') {
    return '.webp';
  }
  if (contentType === 'image/jpeg') {
    return '.jpg';
  }
  return '.png';
}

function resolveCutoutRecognitionType(category = '', subCategory = '') {
  const text = `${category || ''} ${subCategory || ''}`.trim();
  if (!text) {
    return '';
  }

  if (
    text.includes('配饰') ||
    text.includes('项链') ||
    text.includes('耳环') ||
    text.includes('耳饰') ||
    text.includes('戒指') ||
    text.includes('手链') ||
    text.includes('胸针') ||
    text.includes('首饰')
  ) {
    return 'jewelry';
  }

  return 'clothes';
}
