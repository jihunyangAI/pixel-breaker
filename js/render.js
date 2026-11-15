// 렌더러: 원본 해상도 캔버스, 블록 글꼴, 공용 도형

import { V, PAL, SIZES, setLayout } from './config.js';
import { shade } from './util.js';

// 5x7 격자 글리프. 모양은 레트로, 그리기는 벡터 사각형이라 어떤 해상도에서도 선명하다.
const G = {
  A: '.XXX./X...X/X...X/XXXXX/X...X/X...X/X...X',
  B: 'XXXX./X...X/X...X/XXXX./X...X/X...X/XXXX.',
  C: '.XXX./X...X/X..../X..../X..../X...X/.XXX.',
  D: 'XXXX./X...X/X...X/X...X/X...X/X...X/XXXX.',
  E: 'XXXXX/X..../X..../XXXX./X..../X..../XXXXX',
  F: 'XXXXX/X..../X..../XXXX./X..../X..../X....',
  G: '.XXX./X...X/X..../X.XXX/X...X/X...X/.XXXX',
  H: 'X...X/X...X/X...X/XXXXX/X...X/X...X/X...X',
  I: '.XXX./..X../..X../..X../..X../..X../.XXX.',
  J: '..XXX/...X./...X./...X./...X./X..X./.XX..',
  K: 'X...X/X..X./X.X../XX.../X.X../X..X./X...X',
  L: 'X..../X..../X..../X..../X..../X..../XXXXX',
  M: 'X...X/XX.XX/X.X.X/X.X.X/X...X/X...X/X...X',
  N: 'X...X/XX..X/X.X.X/X..XX/X...X/X...X/X...X',
  O: '.XXX./X...X/X...X/X...X/X...X/X...X/.XXX.',
  P: 'XXXX./X...X/X...X/XXXX./X..../X..../X....',
  Q: '.XXX./X...X/X...X/X...X/X.X.X/X..X./.XX.X',
  R: 'XXXX./X...X/X...X/XXXX./X.X../X..X./X...X',
  S: '.XXXX/X..../X..../.XXX./....X/....X/XXXX.',
  T: 'XXXXX/..X../..X../..X../..X../..X../..X..',
  U: 'X...X/X...X/X...X/X...X/X...X/X...X/.XXX.',
  V: 'X...X/X...X/X...X/X...X/X...X/.X.X./..X..',
  W: 'X...X/X...X/X...X/X.X.X/X.X.X/XX.XX/X...X',
  X: 'X...X/X...X/.X.X./..X../.X.X./X...X/X...X',
  Y: 'X...X/X...X/.X.X./..X../..X../..X../..X..',
  Z: 'XXXXX/....X/...X./..X../.X.../X..../XXXXX',
  0: '.XXX./X...X/X..XX/X.X.X/XX..X/X...X/.XXX.',
  1: '..X../.XX../..X../..X../..X../..X../.XXX.',
  2: '.XXX./X...X/....X/...X./..X../.X.../XXXXX',
  3: 'XXXX./....X/....X/.XXX./....X/....X/XXXX.',
  4: '...X./..XX./.X.X./X..X./XXXXX/...X./...X.',
  5: 'XXXXX/X..../XXXX./....X/....X/X...X/.XXX.',
  6: '..XX./.X.../X..../XXXX./X...X/X...X/.XXX.',
  7: 'XXXXX/....X/...X./..X../.X.../.X.../.X...',
  8: '.XXX./X...X/X...X/.XXX./X...X/X...X/.XXX.',
  9: '.XXX./X...X/X...X/.XXXX/....X/...X./.XX..',
  '.': '...../...../...../...../...../.XX../.XX..',
  ',': '...../...../...../...../.XX../..X../.X...',
  '!': '..X../..X../..X../..X../..X../...../..X..',
  '?': '.XXX./X...X/....X/...X./..X../...../..X..',
  '-': '...../...../...../XXXXX/...../...../.....',
  '+': '...../..X../..X../XXXXX/..X../..X../.....',
  ':': '...../.XX../.XX../...../.XX../.XX../.....',
  '/': '....X/....X/...X./..X../.X.../X..../X....',
  "'": '..X../..X../.X.../...../...../...../.....',
  '%': 'XX..X/XX.X./...X./..X../.X.../.X.XX/X..XX',
  '(': '...X./..X../.X.../.X.../.X.../..X../...X.',
  ')': '.X.../..X../...X./...X./...X./..X../.X...',
  '<': '...X./..X../.X.../X..../.X.../..X../...X.',
  '>': '.X.../..X../...X./....X/...X./..X../.X...',
  '=': '...../...../XXXXX/...../XXXXX/...../.....',
  '_': '...../...../...../...../...../...../XXXXX',
  '*': '...../X.X.X/.XXX./XXXXX/.XXX./X.X.X/.....',
  '#': '.X.X./XXXXX/.X.X./.X.X./XXXXX/.X.X./.....',
  '^': '..X../.XXX./XXXXX/...../...../...../.....',
  '~': '...../...../...../...../XXXXX/.XXX./..X..',   // 아래 화살표로 사용
  $: '...../.X.X./XXXXX/XXXXX/.XXX./..X../.....',    // 하트
};

// 글리프를 [행, 시작열, 길이] 런으로 미리 변환
const RUNS = {};
for (const ch in G) {
  const runs = [];
  G[ch].split('/').forEach((row, r) => {
    let c = 0;
    while (c < 5) {
      if (row[c] === 'X') { let e = c; while (e < 5 && row[e] === 'X') e++; runs.push([r, c, e - c]); c = e; } else c++;
    }
  });
  RUNS[ch] = runs;
}

const glowCache = new Map();

export const R = {
  canvas: null, ctx: null,
  cw: 0, ch: 0, dpr: 1, k: 1, ox: 0, oy: 0,
  onResize: null,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.resize();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    let dpr = window.devicePixelRatio || 1;
    const iw = Math.max(1, window.innerWidth), ih = Math.max(1, window.innerHeight);
    // 원본 해상도로 그린다. 비정상적으로 큰 캔버스만 방지.
    const maxSide = 4320;
    if (Math.max(iw, ih) * dpr > maxSide) dpr = maxSide / Math.max(iw, ih);
    this.dpr = dpr; this.iw = iw; this.ih = ih; this.rawDpr = window.devicePixelRatio || 1;
    this.cw = Math.round(iw * dpr); this.ch = Math.round(ih * dpr);
    this.canvas.width = this.cw; this.canvas.height = this.ch;
    // 화면 비율에 따라 더 크게 보이는 레이아웃을 고른다 (세로 폰은 세로 레이아웃)
    const kL = Math.min(this.cw / SIZES.land[0], this.ch / SIZES.land[1]);
    const kP = Math.min(this.cw / SIZES.port[0], this.ch / SIZES.port[1]);
    setLayout(kP > kL);
    this.k = V.portrait ? kP : kL;
    // 세로로 긴 폰은 논리 높이를 늘려 화면을 채운다. 늘어난 아래쪽은 엄지 조작 공간이 된다.
    if (V.portrait) V.h = Math.min(2000, Math.max(SIZES.port[1], Math.floor(this.ch / this.k)));
    this.ox = Math.round((this.cw - V.w * this.k) / 2);
    this.oy = Math.round((this.ch - V.h * this.k) / 2);
    if (this.onResize) this.onResize();
  },

  toLogical(clientX, clientY) {
    return [(clientX * this.dpr - this.ox) / this.k, (clientY * this.dpr - this.oy) / this.k];
  },

  begin(shx = 0, shy = 0) {
    if (window.innerWidth !== this.iw || window.innerHeight !== this.ih || (window.devicePixelRatio || 1) !== this.rawDpr) this.resize();
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#05050c';
    c.fillRect(0, 0, this.cw, this.ch);
    // 4:3 바깥 여백: 옅은 격자
    if (this.ox > 0 || this.oy > 0) {
      c.fillStyle = '#0b0b18';
      const g = Math.max(8, Math.round(32 * this.k));
      for (let x = this.ox % g; x < this.cw; x += g) c.fillRect(x, 0, 1, this.ch);
      for (let y = this.oy % g; y < this.ch; y += g) c.fillRect(0, y, this.cw, 1);
    }
    c.save();
    c.setTransform(this.k, 0, 0, this.k, this.ox, this.oy);
    c.beginPath(); c.rect(0, 0, V.w, V.h); c.clip();
    c.translate(shx, shy);
  },

  end() { this.ctx.restore(); },

  textWidth(str, size) { return (String(str).length * 6 - 1) * (size / 7); },

  // y 는 글자 윗변. 문자열 전체를 하나의 패스로 채워 셀 사이 이음새가 생기지 않는다.
  text(str, x, y, size, color = PAL.text, align = 'l') {
    str = String(str).toUpperCase();
    const s = size / 7, c = this.ctx;
    const w = (str.length * 6 - 1) * s;
    if (align === 'c') x -= w / 2; else if (align === 'r') x -= w;
    c.fillStyle = color;
    c.beginPath();
    for (let i = 0; i < str.length; i++) {
      const runs = RUNS[str[i]];
      if (runs) for (let j = 0; j < runs.length; j++) {
        const r = runs[j];
        c.rect(x + r[1] * s, y + r[0] * s, r[2] * s, s);
      }
      x += 6 * s;
    }
    c.fill();
  },

  // 로고용: 각 셀을 작은 베벨 블록으로 그린다
  blockText(str, x, y, cell, colors, align = 'c', shineX = -9999) {
    str = String(str).toUpperCase();
    const c = this.ctx, w = (str.length * 6 - 1) * cell;
    if (align === 'c') x -= w / 2;
    const b = Math.max(1.5, cell * 0.16);
    for (let i = 0; i < str.length; i++) {
      const g = G[str[i]];
      if (g) {
        const rows = g.split('/');
        for (let r = 0; r < 7; r++) {
          const base = colors[r % colors.length];
          for (let q = 0; q < 5; q++) if (rows[r][q] === 'X') {
            const px = x + q * cell, py = y + r * cell, s = cell - 1;
            // 빛이 대각선으로 훑고 지나간다
            const lit = Math.abs(px + py * 0.5 - shineX) < cell * 2.2;
            const col = lit ? shade(base, 0.6) : base;
            c.fillStyle = col; c.fillRect(px, py, s, s);
            c.fillStyle = shade(base, lit ? 0.9 : 0.5); c.fillRect(px, py, s, b); c.fillRect(px, py, b, s);
            c.fillStyle = shade(base, lit ? -0.1 : -0.45); c.fillRect(px, py + s - b, s, b); c.fillRect(px + s - b, py, b, s);
          }
        }
      }
      x += 6 * cell;
    }
  },

  rr(x, y, w, h, r) {
    const c = this.ctx;
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r);
    else {
      c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    }
  },

  // 가산 합성 글로우 (미리 그려 둔 방사형 스프라이트 재사용)
  glow(x, y, r, color, alpha = 1) {
    let s = glowCache.get(color);
    if (!s) {
      s = document.createElement('canvas'); s.width = s.height = 128;
      const g = s.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, color); gr.addColorStop(0.35, color + '88'); gr.addColorStop(1, color + '00');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
      glowCache.set(color, s);
    }
    const c = this.ctx, pa = c.globalAlpha;
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = pa * alpha;
    c.drawImage(s, x - r, y - r, r * 2, r * 2);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = pa;
  },

  // 가로 줄무늬가 흘러내리는 레트로 태양
  sun(cx, cy, r, top, bottom, alpha, t, bg = PAL.bg) {
    const c = this.ctx;
    c.save();
    c.beginPath(); c.arc(cx, cy, r, 0, 6.283); c.clip();
    const g = c.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    c.globalAlpha *= alpha; c.fillStyle = g; c.fillRect(cx - r, cy - r, r * 2, r * 2);
    c.globalAlpha = 1; c.fillStyle = bg;
    const ph = (t * 0.25) % 1;
    for (let k = 0; k < 7; k++) {
      const f = (k + ph) / 7;
      c.fillRect(cx - r, cy - r * 0.1 + f * r * 1.1, r * 2, 2 + f * r * 0.09);
    }
    c.restore();
  },

  // 메뉴 화면 배경: 별 + 태양 + 산 능선 + 원근 그리드
  backdrop(t, color) {
    const c = this.ctx, W = V.w, H = V.h, hz = Math.round(H * 0.625);
    const sky = c.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#07071a'); sky.addColorStop(1, shade(color, -0.82));
    c.fillStyle = sky; c.fillRect(0, 0, W, hz);
    c.fillStyle = PAL.bg; c.fillRect(0, hz, W, H - hz);
    c.fillStyle = '#ffffff';
    for (let i = 0; i < 90; i++) {
      const x = (i * 197.3) % W, y = (i * 113.7 + t * (5 + (i % 5) * 3)) % hz;
      c.globalAlpha = 0.2 + 0.45 * Math.abs(Math.sin(t * 1.3 + i));
      const s = 1.5 + (i % 3);
      c.fillRect(x, y, s, s);
    }
    c.globalAlpha = 1;
    this.glow(W / 2, hz - 60, 420, color, 0.3);
    this.sun(W / 2, hz - 50, 190, PAL.yellow, color, 0.75, t, shade(color, -0.82));
    for (let L = 0; L < 2; L++) {
      c.fillStyle = L ? '#0a0a1c' : '#161636';
      c.beginPath(); c.moveTo(0, hz);
      const step = 70 - L * 14;
      for (let x = 0, i = 0; x <= W + step; x += step, i++) {
        const far = Math.abs(x - W / 2) / (W / 2);
        const hgt = (18 + ((i * 7919 + L * 131) % 53)) * (0.35 + far * 1.1) * (L ? 0.7 : 1.15);
        c.lineTo(x, hz - hgt);
      }
      c.lineTo(W, hz); c.fill();
    }
    c.strokeStyle = color; c.lineWidth = 2; c.globalAlpha = 0.22;
    c.beginPath();
    const ph = (t * 0.5) % 1;
    for (let i = 0; i < 14; i++) {
      const f = (i + ph) / 14, y = hz + (H - hz) * f * f;
      c.moveTo(0, y); c.lineTo(W, y);
    }
    for (let i = -12; i <= 12; i++) { c.moveTo(W / 2 + i * 40, hz); c.lineTo(W / 2 + i * 230, H); }
    c.stroke();
    c.globalAlpha = 0.6; c.fillStyle = color; c.fillRect(0, hz - 1, W, 2);
    c.globalAlpha = 1;
  },

  // 어두운 패널 (메뉴 글자 가독성용)
  panel(x, y, w, h, color = PAL.frame) {
    const c = this.ctx;
    c.fillStyle = 'rgba(8,8,20,0.86)'; c.fillRect(x, y, w, h);
    c.fillStyle = color;
    c.fillRect(x, y, w, 3); c.fillRect(x, y + h - 3, w, 3); c.fillRect(x, y, 3, h); c.fillRect(x + w - 3, y, 3, h);
  },
};
