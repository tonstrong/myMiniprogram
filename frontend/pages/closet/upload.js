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
          const fileContentBase64 = await readFileAsBase64(tempFilePath);
          const result = await api.request({
            url: '/api/closet/items/upload',
            method: 'POST',
            data: {
              sourceType: 'album',
              fileContentBase64,
              fileContentType: inferImageContentType(tempFilePath, file.fileType),
              originalFilename: tempFilePath.split('/').pop() || 'image.jpg'
            }
          });

          this.setData({ status: 'done' });
          wx.hideLoading();
          wx.showToast({ title: '识别任务已创建', icon: 'success' });

          setTimeout(() => {
            wx.redirectTo({
              url: `/pages/closet/detail?id=${result.itemId}&isNew=1&taskId=${result.taskId}&preview=${encodeURIComponent(tempFilePath)}`
            });
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

function inferImageContentType(filePath, fileType) {
  if (fileType === 'image') {
    const lower = filePath.toLowerCase();
    if (lower.endsWith('.png')) {
      return 'image/png';
    }
    if (lower.endsWith('.webp')) {
      return 'image/webp';
    }
  }

  const lower = filePath.toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'image/jpeg';
}
