const imageUrlCache = new Map();
const CLOUD_URL_CACHE_TTL_MS = 10 * 60 * 1000;

export async function resolveImageUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return '';
  }

  if (!inputUrl.startsWith('cloud://')) {
    return resolveHttpImageUrl(inputUrl);
  }

  const cached = imageUrlCache.get(inputUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  if (!wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') {
    return inputUrl;
  }

  try {
    const res = await wx.cloud.getTempFileURL({
      fileList: [inputUrl]
    });
    const tempFileURL = res.fileList?.[0]?.tempFileURL || '';
    if (tempFileURL) {
      imageUrlCache.set(inputUrl, {
        url: tempFileURL,
        expiresAt: Date.now() + CLOUD_URL_CACHE_TTL_MS
      });
    }
    return tempFileURL || inputUrl;
  } catch (error) {
    console.error('Resolve cloud image url failed', error);
    return inputUrl;
  }
}

async function resolveHttpImageUrl(inputUrl) {
  if (!shouldDownloadHttpImage(inputUrl)) {
    return inputUrl;
  }

  const cached = imageUrlCache.get(inputUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  try {
    const tempFilePath = await downloadImageToTempFile(inputUrl);
    if (tempFilePath) {
      imageUrlCache.set(inputUrl, {
        url: tempFilePath,
        expiresAt: Date.now() + CLOUD_URL_CACHE_TTL_MS
      });
      return tempFilePath;
    }
  } catch (error) {
    console.error('Resolve http image url failed', error);
  }

  return inputUrl;
}

function shouldDownloadHttpImage(inputUrl) {
  return /^https?:\/\//.test(inputUrl) && inputUrl.includes('/api/closet/items/') && inputUrl.includes('/image?');
}

function downloadImageToTempFile(url) {
  return new Promise((resolve) => {
    wx.downloadFile({
      url,
      success: (res) => resolve(res.tempFilePath || ''),
      fail: () => resolve('')
    });
  });
}
