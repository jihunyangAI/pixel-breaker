export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const pad = (n, len) => String(Math.floor(n)).padStart(len, '0');

// 시드 기반 난수 (DAILY 재현용)
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const shadeCache = new Map();
// amt > 0 이면 흰색 쪽, < 0 이면 검정 쪽으로 섞는다
export function shade(hex, amt) {
  const key = hex + amt;
  let v = shadeCache.get(key);
  if (v) return v;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = amt > 0 ? 255 : 0, a = Math.abs(amt);
  r = Math.round(r + (t - r) * a); g = Math.round(g + (t - g) * a); b = Math.round(b + (t - b) * a);
  v = `rgb(${r},${g},${b})`;
  shadeCache.set(key, v);
  return v;
}

export function todaySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
export function todayLabel() {
  const d = new Date();
  return pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2);
}
