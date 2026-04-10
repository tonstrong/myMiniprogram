import api from '../../utils/api';

Page({
  data: {
    status: 'idle', // idle, uploading, processing, done
    previewImage: '',
    animationData: {}
  },

  onLoad() {
    // init logic
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({
          previewImage: tempFilePath,
          status: 'uploading'
        });
        this.uploadAndProcess(tempFilePath);
      }
    });
  },

  async uploadAndProcess(tempFilePath) {
    try {
      // 1. Upload
      const uploadRes = await api.uploadFile({
        url: '/api/closet/items/upload',
        filePath: tempFilePath,
        name: 'file',
        formData: { sourceType: 'camera' }
      });
      console.log('Upload success, taskId:', uploadRes.taskId);
      
      this.setData({ status: 'processing' });
      
      // 2. Poll Task Status
      const taskRes = await api.pollTaskStatus(uploadRes.taskId);
      console.log('Task finished:', taskRes);

      this.setData({ status: 'done' });
      wx.showToast({ title: '识别完成', icon: 'success' });

      // redirect to detail
      setTimeout(() => {
        // assume the uploaded item ID is passed via taskRes, fallback to mock if undefined
        const itemId = uploadRes.itemId || 'mock_new'; 
        wx.redirectTo({ url: `/pages/closet/detail?id=${itemId}&isNew=true` });
      }, 1000);

    } catch (e) {
      console.error('Upload/Process error:', e);
      this.setData({ status: 'idle' });
    }
  }
});
