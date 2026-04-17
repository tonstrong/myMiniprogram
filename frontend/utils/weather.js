import api from './api';
import { getCachedCity } from './profile-cache';

const WEATHER_CACHE_KEY = 'weather:current';
const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000;
let inflightPromise = null;

export async function getCurrentWeather(options = {}) {
  const forceRefresh = !!options.forceRefresh;
  const city = getCachedCity();
  if (!city) {
    throw createMissingCityError();
  }

  const cached = readWeatherCache();
  if (
    !forceRefresh &&
    cached &&
    cached.forCity === city &&
    Date.now() - cached.cachedAt < WEATHER_CACHE_TTL_MS
  ) {
    return cached.payload;
  }

  if (!forceRefresh && inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = api.request({
    url: `/api/weather/current${forceRefresh ? '?force=1' : ''}`,
    method: 'GET'
  }).then((payload) => {
    wx.setStorageSync(WEATHER_CACHE_KEY, {
      cachedAt: Date.now(),
      forCity: city,
      payload
    });
    return payload;
  }).finally(() => {
    inflightPromise = null;
  });

  return inflightPromise;
}

function readWeatherCache() {
  try {
    return wx.getStorageSync(WEATHER_CACHE_KEY) || null;
  } catch (error) {
    return null;
  }
}

function createMissingCityError() {
  const error = new Error('请先设置所在城市');
  error.code = 'CITY_NOT_SET';
  return error;
}
