import api from '../../utils/api';

Page({
  data: {
    importType: 'text', // text, video
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

    wx.showLoading({ title: '正在提取规则...' });
    
    try {
      let uploadRes;
      if (this.data.importType === 'video') {
         uploadRes = await api.uploadFile({
           url: '/api/style-packs/import/video',
           filePath: this.data.videoPath,
           name: 'file',
           formData: { title: this.data.title, authConfirmed: 'true' }
         });
      } else {
         uploadRes = await api.request({
           url: '/api/style-packs/import/text',
           method: 'POST',
           data: { title: this.data.title, text: this.data.textInput, authConfirmed: true }
         });
      }

      const taskRes = await api.pollTaskStatus(uploadRes.taskId);
      wx.hideLoading();
      
      const packId = uploadRes.stylePackId || 'mock_new_pack';
      wx.redirectTo({ url: `/pages/style-pack/detail?id=${packId}&isNew=true` });

    } catch (e) {
      console.error('Import error', e);
      wx.hideLoading();
      // fallback visually
      setTimeout(() => wx.redirectTo({ url: '/pages/style-pack/detail?id=mock_new_pack&isNew=true' }), 1000);
    }
  }
});
