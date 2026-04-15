const imageUrlCache = new Map();

export async function resolveImageUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return '';
  }

  if (!inputUrl.startsWith('cloud://')) {
    return inputUrl;
  }

  if (imageUrlCache.has(inputUrl)) {
    return imageUrlCache.get(inputUrl);
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
      imageUrlCache.set(inputUrl, tempFileURL);
    }
    return tempFileURL;
  } catch (error) {
    console.error('Resolve cloud image url failed', error);
    return '';
  }
}
