import api from '../../utils/api';

Page({
  data: {
    status: 'idle',
    previewImage: ''
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const file = res.tempFiles[0];
        const tempFilePath = file.tempFilePath;
        this.setData({
          previewImage: tempFilePath,
          status: 'uploading'
        });

        wx.showLoading({ title: '上传中...' });
        try {
          const result = await api.request({
            url: '/api/closet/items/upload',
            method: 'POST',
            data: {
              sourceType: 'album',
              originalFilename: tempFilePath.split('/').pop() || 'image.jpg'
            }
          });

          this.setData({ status: 'done' });
          wx.hideLoading();
          wx.showToast({ title: '识别任务已创建', icon: 'success' });

          setTimeout(() => {
            wx.redirectTo({ url: `/pages/closet/detail?id=${result.itemId}&isNew=1&taskId=${result.taskId}` });
          }, 600);
        } catch (error) {
          wx.hideLoading();
          console.error('Upload item failed', error);
          this.setData({ status: 'idle' });
          wx.showToast({ title: '上传失败', icon: 'none' });
        }
      }
    });
  }
});
