export function chooseLocationWithPermission() {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success(settingRes) {
        const auth = settingRes.authSetting['scope.userLocation'];
        if (auth === false) {
          wx.showModal({
            title: '需要定位权限',
            content: '用于识别你当前所在城市，后续可联动天气与温度推荐穿搭。',
            success(modalRes) {
              if (!modalRes.confirm) {
                reject(new Error('location permission denied'));
                return;
              }

              wx.openSetting({
                success(openRes) {
                  if (openRes.authSetting['scope.userLocation']) {
                    openChooseLocation(resolve, reject);
                    return;
                  }
                  reject(new Error('location permission denied'));
                },
                fail: reject
              });
            }
          });
          return;
        }

        openChooseLocation(resolve, reject);
      },
      fail: reject
    });
  });
}

export function extractCityFromAddress(address) {
  if (!address) {
    return '';
  }

  const normalized = address.replace(/\s+/g, '');
  const directCity = normalized.match(/(北京市|上海市|天津市|重庆市|香港特别行政区|澳门特别行政区)/);
  if (directCity) {
    return directCity[0];
  }

  const cityMatch = normalized.match(/([^省自治区特别行政区]+市)/);
  if (cityMatch) {
    return cityMatch[1];
  }

  return '';
}

function openChooseLocation(resolve, reject) {
  wx.chooseLocation({
    success: resolve,
    fail: reject
  });
}
