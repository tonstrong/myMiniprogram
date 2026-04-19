const imageUrlCache = new Map();
const CLOUD_URL_CACHE_TTL_MS = 10 * 60 * 1000;

export async function resolveImageUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return '';
  }

  if (!inputUrl.startsWith('cloud://')) {
    return inputUrl;
  }

  const cached = imageUrlCache.get(inputUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }

  if (!wx.cloud || typeof wx.cloud.getTempFileURL !== 'function') {
    return '';
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
    return tempFileURL;
  } catch (error) {
    console.error('Resolve cloud image url failed', error);
    return '';
  }
}
