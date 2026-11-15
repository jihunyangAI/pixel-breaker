// 화면 효과: 블룸, 색수차, 스캔라인, 비네팅.
// - 블룸용 저해상도 이미지는 본 캔버스를 읽어 오지 않고 장면을 작게 한 번 더 그려서 만든다
//   (큰 캔버스를 매 프레임 복사하는 비용을 피하기 위해).
// - 큰 화면에서는 블룸 이미지를 두 프레임에 한 번만 갱신한다. 흐릿한 빛이라 차이가 보이지 않는다.
// - 스캔라인과 비네팅은 움직이지 않으므로 캔버스 위에 얹은 CSS 레이어로 처리한다.

import { V } from './config.js';
import { R } from './render.js';
import { Storage } from './storage.js';

const mk = () => { const c = document.createElement('canvas'); return [c, c.getContext('2d')]; };

export const FX = {
  q: 2,            // 자동 품질 (프레임이 밀리면 낮아진다. 게임 해상도는 건드리지 않는다)
  ready: false,
  tick: 0,
  fresh: false,    // 이번 프레임에 블룸 원본(c1)을 새로 그렸는지
  lastLvl: -1,

  build() {
    // c1 장면 축소본 / cb 밝은 부분만 / c2, c3 번짐 / ct 색수차용 임시
    [this.c1, this.b1] = mk(); [this.cb, this.bb] = mk(); [this.c2, this.b2] = mk(); [this.c3, this.b3] = mk(); [this.ct, this.bt] = mk();
    this.hasFilter = 'filter' in this.b1;
    this.ready = true;
    R.onResize = () => this.layout();
    this.layout();
  },

  layout() {
    const cw = R.cw, ch = R.ch;
    const div = Math.max(4, Math.ceil(cw / 720));          // 4K 에서도 블룸 캔버스는 640px 안팎
    const w1 = Math.max(2, Math.ceil(cw / div)), h1 = Math.max(2, Math.ceil(ch / div));
    for (const c of [this.c1, this.cb, this.ct]) { c.width = w1; c.height = h1; }
    this.c2.width = Math.max(2, w1 >> 1); this.c2.height = Math.max(2, h1 >> 1);
    this.c3.width = Math.max(2, w1 >> 2); this.c3.height = Math.max(2, h1 >> 2);
    this.heavy = cw * ch > 3e6;
    this.fresh = false; this.tick = 0;
    this.lastLvl = -1;     // 다음 post() 에서 CSS 레이어를 다시 맞춘다
  },

  overlay(lvl) {
    const el = this.crt || (this.crt = document.getElementById('crt'));
    if (!el) return;
    if (!lvl) { el.style.display = 'none'; return; }
    const d = R.dpr, s = el.style;
    s.display = 'block';
    s.left = R.ox / d + 'px'; s.top = R.oy / d + 'px';
    s.width = (V.w * R.k) / d + 'px'; s.height = (V.h * R.k) / d + 'px';
    const layers = ['radial-gradient(ellipse at center, rgba(0,0,0,0) 58%, rgba(0,0,0,0.5) 100%)'];
    // 화면이 작아 줄 간격이 촘촘해지면 줄무늬가 화질을 해치므로 옅게 한다
    const sa = 0.17 * Math.min(1, Math.max(0, (R.k - 0.5) / 0.5));
    if (lvl > 1 && sa > 0) {
      const p = Math.max(3, Math.round(R.k * 4)) / d, th = Math.max(1, Math.round((p * d) / 3)) / d;
      const dark = `rgba(0,0,0,${sa.toFixed(3)})`;
      layers.push(`repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0, rgba(0,0,0,0) ${p - th}px, ${dark} ${p - th}px, ${dark} ${p}px)`);
    }
    s.background = layers.join(',');
  },

  lower() { if (this.q > 0) this.q--; },
  level() { return Math.min(Storage.data.settings.fx, this.q); },

  // 장면을 블룸용 작은 캔버스에 다시 그린다
  capture(drawFn, shx = 0, shy = 0) {
    this.fresh = false;
    const q = this.level();
    if (q < 1) return;
    if (!this.ready) this.build();
    this.tick++;
    if ((this.heavy || q < 2) && this.tick % 2 && this.tick > 1) return;      // 큰 화면: 한 프레임 걸러 갱신
    const b = this.b1, c1 = this.c1, main = R.ctx;
    const sx = c1.width / R.cw, sy = c1.height / R.ch;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalAlpha = 1; b.globalCompositeOperation = 'source-over';
    b.fillStyle = '#000000'; b.fillRect(0, 0, c1.width, c1.height);
    b.save();
    b.setTransform(R.k * sx, 0, 0, R.k * sy, R.ox * sx, R.oy * sy);
    b.beginPath(); b.rect(0, 0, V.w, V.h); b.clip();
    b.translate(shx, shy);
    R.ctx = b;
    try { drawFn(); } finally { R.ctx = main; b.restore(); }
    this.fresh = true;
  },

  post(aberr) {
    const lvl = Storage.data.settings.fx;
    if (lvl !== this.lastLvl) { if (lvl && !this.ready) this.build(); this.lastLvl = lvl; this.overlay(lvl); }
    if (!lvl) return;
    const q = this.level();
    if (q < 1) return;
    const c = R.ctx, cw = R.cw, ch = R.ch;
    const { bb, b2, b3, bt, c1, cb, c2, c3, ct } = this;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.imageSmoothingEnabled = true;

    // 큰 충격 때의 색수차: 빨강/파랑 성분을 좌우로 어긋나게 더한다
    if (lvl > 1 && aberr > 0.02) {
      const d = aberr * 10 * R.k;
      c.globalCompositeOperation = 'lighter';
      for (const [col, dir] of [['#ff0030', -1], ['#0060ff', 1]]) {
        bt.globalCompositeOperation = 'copy'; bt.drawImage(c1, 0, 0);
        bt.globalCompositeOperation = 'multiply'; bt.fillStyle = col; bt.fillRect(0, 0, ct.width, ct.height);
        c.globalAlpha = Math.min(0.6, aberr * 0.8);
        c.drawImage(ct, dir * d, 0, cw, ch);
      }
      c.globalAlpha = 1;
    }

    if (this.fresh) {
      // 밝은 부분만 남기기: 자기 자신을 곱해 어두운 영역을 눌러 준다
      bb.globalCompositeOperation = 'copy'; bb.drawImage(c1, 0, 0);
      bb.globalCompositeOperation = 'multiply'; bb.drawImage(c1, 0, 0);
      b2.globalCompositeOperation = 'copy'; b2.globalAlpha = 1;
      if (this.hasFilter) b2.filter = 'blur(2px)';
      b2.drawImage(cb, 0, 0, c2.width, c2.height);
      if (q > 1) {
        // 넓게 번지는 층을 작은 캔버스 안에서 먼저 합쳐, 본 캔버스에는 한 번만 합성한다
        b3.globalCompositeOperation = 'copy';
        if (this.hasFilter) b3.filter = 'blur(2px)';
        b3.drawImage(c2, 0, 0, c3.width, c3.height);
        if (this.hasFilter) b2.filter = 'none';
        b2.globalCompositeOperation = 'lighter'; b2.globalAlpha = 0.87;
        b2.imageSmoothingEnabled = true;
        b2.drawImage(c3, 0, 0, c2.width, c2.height);
        b2.globalAlpha = 1;
      }
    }
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = q > 1 ? 0.3 : 0.26;
    c.drawImage(c2, 0, 0, cw, ch);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  },
};
