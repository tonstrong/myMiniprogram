import api from '../../utils/api';

Page({
  data: {
    importType: 'text',
    title: '',
    textInput: '',
    videoPath: '',
    agreed: false
  },

  switchType(e) {
    this.setData({ importType: e.currentTarget.dataset.type });
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  onTextInput(e) {
    this.setData({ textInput: e.detail.value });
  },

  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed });
  },

  chooseVideo() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['video'],
      success: (res) => {
        this.setData({ videoPath: res.tempFiles[0].tempFilePath });
      }
    });
  },

  async submitImport() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先勾选授权声明', icon: 'none' });
      return;
    }
    if (!this.data.title) {
      wx.showToast({ title: '请填写风格包名称', icon: 'none' });
      return;
    }
    if (this.data.importType === 'text' && !this.data.textInput.trim()) {
      wx.showToast({ title: '请填写文本内容', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在导入...' });
    try {
      const result = await api.request({
        url: this.data.importType === 'text' ? '/api/style-packs/import/text' : '/api/style-packs/import/video',
        method: 'POST',
        data: this.data.importType === 'text'
          ? {
              title: this.data.title,
              text: this.data.textInput,
              authConfirmed: true
            }
          : {
              title: this.data.title,
              authConfirmed: true
            }
      });

      wx.hideLoading();
      wx.redirectTo({ url: `/pages/style-pack/detail?id=${result.stylePackId}&isNew=1` });
    } catch (error) {
      wx.hideLoading();
      console.error('Import style pack failed', error);
      wx.showToast({ title: '导入失败', icon: 'none' });
    }
  }
});
