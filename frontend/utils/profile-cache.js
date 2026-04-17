const PROFILE_CACHE_KEY = 'user-profile:summary';

export function cacheProfile(profile = {}) {
  try {
    wx.setStorageSync(PROFILE_CACHE_KEY, {
      city: (profile.city || '').trim(),
      nickname: profile.nickname || '',
      avatarUrl: profile.avatarUrl || '',
      updatedAt: Date.now()
    });
  } catch (error) {
    // ignore storage failures
  }
}

export function getCachedProfile() {
  try {
    return wx.getStorageSync(PROFILE_CACHE_KEY) || null;
  } catch (error) {
    return null;
  }
}

export function getCachedCity() {
  const profile = getCachedProfile();
  return (profile?.city || '').trim();
}
