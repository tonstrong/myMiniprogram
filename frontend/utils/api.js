const BASE_URL = 'http://39.97.158.168:4000';

function request(options) {
  return new Promise(async (resolve, reject) => {
    let token = wx.getStorageSync('token') || '';
    let userId = wx.getStorageSync('userId') || '';

    // 如果没有登录态且不是登录接口，尝试等待全局登录准备完毕，避免页面启动时并发请求导致 401
    if ((!token || !userId) && options.url !== '/api/auth/wechat-login') {
      const app = getApp();
      if (app && app.globalData && app.globalData.loginPromise) {
        try {
          await app.globalData.loginPromise;
          token = wx.getStorageSync('token') || '';
          userId = wx.getStorageSync('userId') || '';
        } catch (e) { }
      }
    }

    wx.request({
      url: `${BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        'x-user-id': userId || '',
        ...options.header
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // 假设后端返回标准结构: { code, message, data, requestId }
          if (res.data.code === 0 || !res.data.code) {
            resolve(res.data.data !== undefined ? res.data.data : res.data);
          } else {
            console.error(`API Error HTTP 200 with code: ${res.data.code}`, res.data);
            reject(res.data);
          }
        } else {
          console.error(`API Error HTTP Status: ${res.statusCode}`, res.data);
          reject(res.data);
        }
      },
      fail(err) {
        console.error(`Network Request Failed: ${options.url}`, err);
        wx.showToast({ title: '网络异常，请重试', icon: 'none' });
        reject(err);
      }
    });
  });
}

function uploadFile(options) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token') || '';
    const userId = wx.getStorageSync('userId') || '';
    wx.uploadFile({
      url: `${BASE_URL}${options.url}`,
      filePath: options.filePath,
      name: options.name || 'file',
      formData: options.formData || {},
      header: {
        'Authorization': token ? `Bearer ${token}` : '',
        'x-user-id': userId || '',
        ...options.header
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(res.data);
            if (data.code === 0 || !data.code) {
              resolve(data.data !== undefined ? data.data : data);
            } else {
              reject(data);
            }
          } catch (e) {
            resolve(res.data);
          }
        } else {
          reject(res);
        }
      },
      fail(err) {
        console.error('Upload Failed:', err);
        reject(err);
      }
    });
  });
}

/**
 * 封装通用轮询机制，主要用于任务中心的耗时任务查询
 */
function pollTaskStatus(taskId, onProgress) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 60; // 最多轮询约1分钟

    const check = () => {
      attempts++;
      request({
        url: `/api/tasks/${taskId}`,
        method: 'GET'
      }).then(res => {
        // res 可包含: status(completed/processing/failed), resultSummary
        if (res.status === 'completed' || res.status === 'done' || res.status === 'active' || res.status === 'needs_review' || res.status === 'needs_confirm') {
          resolve(res);
        } else if (res.status === 'failed') {
          reject(new Error('长任务执行失败'));
        } else {
          if (onProgress) onProgress(res.status, res.progress);
          if (attempts >= maxAttempts) {
            reject(new Error('任务处理超时'));
            return;
          }
          setTimeout(check, 1000); // 1秒后再次轮询
        }
      }).catch(err => reject(err));
    };

    check();
  });
}

export default {
  request,
  uploadFile,
  pollTaskStatus,
  BASE_URL
};
