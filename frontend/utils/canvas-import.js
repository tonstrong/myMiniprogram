export const CANVAS_IMPORT_KEY = 'outfit-canvas:import';

const PRIMARY_LAYOUTS = {
  outer: { x: 0.04, y: 0.04, w: 0.3, h: 0.38 },
  dress: { x: 0.34, y: 0.08, w: 0.34, h: 0.56 },
  top: { x: 0.34, y: 0.08, w: 0.34, h: 0.24 },
  bottom: { x: 0.34, y: 0.32, w: 0.3, h: 0.46 },
  bag: { x: 0.06, y: 0.66, w: 0.18, h: 0.18 },
  shoes: { x: 0.34, y: 0.8, w: 0.28, h: 0.12 }
};

export function buildCanvasLayoutFromItems(items) {
  const layoutItems = [];
  const usedSlots = new Set();
  const overflowItems = [];

  (items || []).forEach((item) => {
    const slotCode = inferSlotCode(item.category);
    const baseLayout = PRIMARY_LAYOUTS[slotCode];

    if (baseLayout && !usedSlots.has(slotCode)) {
      usedSlots.add(slotCode);
      layoutItems.push({
        itemId: item.itemId,
        slotCode,
        x: baseLayout.x,
        y: baseLayout.y,
        w: baseLayout.w,
        h: baseLayout.h,
        layerIndex: layoutItems.length
      });
      return;
    }

    overflowItems.push({
      itemId: item.itemId,
      slotCode: slotCode === 'accessories' ? 'accessories' : 'free'
    });
  });

  overflowItems.forEach((item, index) => {
    const layout = buildOverflowLayout(index);
    layoutItems.push({
      itemId: item.itemId,
      slotCode: item.slotCode,
      x: layout.x,
      y: layout.y,
      w: layout.w,
      h: layout.h,
      layerIndex: layoutItems.length
    });
  });

  return layoutItems;
}

export function saveCanvasImportPayload(payload) {
  wx.setStorageSync(CANVAS_IMPORT_KEY, payload);
}

export function inferSlotCode(category) {
  switch (category) {
    case '上衣':
      return 'top';
    case '下装':
      return 'bottom';
    case '连衣裙':
      return 'dress';
    case '外套':
      return 'outer';
    case '鞋履':
    case '鞋靴':
      return 'shoes';
    case '包袋':
      return 'bag';
    case '配饰':
      return 'accessories';
    default:
      return 'free';
  }
}

function buildOverflowLayout(index) {
  const column = index % 2;
  const row = Math.floor(index / 2);
  return {
    x: 0.7 + column * 0.12,
    y: Math.min(0.1 + row * 0.16, 0.78),
    w: 0.12,
    h: 0.16
  };
}
