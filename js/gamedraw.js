// 플레이 화면 그리기: 필드, 벽돌, 공, 패들, 보스, HUD (가로/세로 레이아웃)

import { V, PF, HUD, PAD, BW, BH, BALL_R, DANGER_Y, PAL, WORLDS, CAPS, PORTRAIT_TOP } from './config.js';
import { shade, pad, clamp } from './util.js';
import { R } from './render.js';
import { Storage } from './storage.js';
import { ORB_R } from './boss.js';

// 일시정지 버튼 영역 (터치용)
export function pauseRect() {
  return V.portrait ? [V.w - 100, 22, 76, 64] : [HUD.x + HUD.w - 70, V.h - 84, 68, 56];
}

function drawBrick(c, b, g) {
  if (b.drop <= 0) return;
  let x = b.x + 1, y = b.y + 1;
  const w = b.w - 2, h = b.h - 2;
  if (b.drop < 1) { const e = 1 - Math.pow(1 - b.drop, 3); y -= (1 - e) * (b.y + 90); }
  let a = 1, col = b.color;
  if (b.type === 'g') {
    a = g.ghostAlpha(b);
    if (a < 0.04) { c.globalAlpha = 0.16; c.strokeStyle = col; c.lineWidth = 1.5; c.strokeRect(x + 2, y + 2, w - 4, h - 4); c.globalAlpha = 1; return; }
    a = 0.15 + a * 0.75;
  }
  if (b.type === 'b') col = '#4a1424';
  c.globalAlpha = a;
  c.fillStyle = col; c.fillRect(x, y, w, h);
  c.fillStyle = shade(col, 0.14); c.fillRect(x + 3, y + 3, w - 6, (h - 6) * 0.45);
  c.fillStyle = shade(col, 0.5); c.fillRect(x, y, w, 3); c.fillRect(x, y, 3, h);
  c.fillStyle = shade(col, -0.45); c.fillRect(x, y + h - 3, w, 3); c.fillRect(x + w - 3, y, 3, h);

  const cx = x + w / 2, cy = y + h / 2;
  switch (b.type) {
    case 'h': {
      c.strokeStyle = shade(col, 0.6); c.lineWidth = 2; c.strokeRect(x + 7, y + 7, w - 14, h - 14);
      const dmg = b.maxHp - b.hp;
      if (dmg > 0) {
        c.strokeStyle = '#05050c'; c.lineWidth = 2; c.beginPath();
        c.moveTo(x + 14, y + 3); c.lineTo(x + 24, y + 14); c.lineTo(x + 18, y + 20); c.lineTo(x + 30, y + h - 3);
        if (dmg > 1) { c.moveTo(x + w - 10, y + 3); c.lineTo(x + w - 22, y + 12); c.lineTo(x + w - 16, y + 19); c.lineTo(x + w - 26, y + h - 3); }
        c.stroke();
      }
      break;
    }
    case 's':
      c.fillStyle = shade(col, -0.5);
      c.fillRect(x + 6, y + 6, 4, 4); c.fillRect(x + w - 10, y + 6, 4, 4); c.fillRect(x + 6, y + h - 10, 4, 4); c.fillRect(x + w - 10, y + h - 10, 4, 4);
      c.fillStyle = shade(col, 0.55); c.globalAlpha = a * 0.5;
      c.beginPath(); c.moveTo(x + 22, y + 3); c.lineTo(x + 32, y + 3); c.lineTo(x + 20, y + h - 3); c.lineTo(x + 10, y + h - 3); c.fill();
      break;
    case 'b': {
      const p = 0.5 + 0.5 * Math.sin(g.t * 9);
      R.glow(cx, cy, 22 + p * 6, PAL.warn, 0.8);
      c.fillStyle = p > 0.5 ? PAL.yellow : PAL.orange;
      c.beginPath(); c.arc(cx, cy, 7, 0, 6.283); c.fill();
      c.fillStyle = PAL.warn; c.fillRect(cx - 1.5, cy - 13, 3, 5);
      break;
    }
    case 'g':
      c.fillStyle = '#05050c'; c.globalAlpha = a * 0.35; c.fillRect(x + 8, y + 8, w - 16, h - 16);
      break;
    case 'm':
      c.strokeStyle = '#15162c'; c.lineWidth = 3; c.beginPath();
      c.moveTo(cx - 8, cy - 6); c.lineTo(cx - 15, cy); c.lineTo(cx - 8, cy + 6);
      c.moveTo(cx + 8, cy - 6); c.lineTo(cx + 15, cy); c.lineTo(cx + 8, cy + 6);
      c.stroke();
      break;
    case 'r':
      c.fillStyle = shade(col, -0.6); c.fillRect(cx - 8, cy - 2, 16, 4); c.fillRect(cx - 2, cy - 8, 4, 16);
      break;
    case 't': {
      const s = (g.t * 60 + b.x) % 140;
      c.fillStyle = '#ffffff'; c.globalAlpha = a * 0.75;
      c.save(); c.beginPath(); c.rect(x + 3, y + 3, w - 6, h - 6); c.clip();
      c.beginPath(); c.moveTo(x + s - 40, y); c.lineTo(x + s - 28, y); c.lineTo(x + s - 42, y + h); c.lineTo(x + s - 54, y + h); c.fill();
      c.restore();
      c.globalAlpha = a; c.fillStyle = shade(col, -0.55);
      c.beginPath(); c.moveTo(cx, cy - 8); c.lineTo(cx + 7, cy); c.lineTo(cx, cy + 8); c.lineTo(cx - 7, cy); c.fill();
      break;
    }
  }
  if (b.flash > 0) { c.globalAlpha = b.flash * 0.75; c.fillStyle = '#ffffff'; c.fillRect(x, y, w, h); }
  c.globalAlpha = 1;
}

function drawBossShape(c, x, y, bo, alpha, flash) {
  const cell = 20, pat = bo.def.pat, col = bo.def.color;
  const x0 = x - bo.w / 2, y0 = y - bo.h / 2;
  c.globalAlpha = alpha;
  for (let pass = 0; pass < 2; pass++) {
    c.fillStyle = pass ? col : shade(col, -0.5);
    c.beginPath();
    for (let r = 0; r < 7; r++) {
      let q = 0;
      while (q < 11) {
        if (pat[r][q] === 'X') {
          let e = q; while (e < 11 && pat[r][e] === 'X') e++;
          if (pass) c.rect(x0 + q * cell, y0 + r * cell, (e - q) * cell - 3, cell - 3);
          else c.rect(x0 + q * cell, y0 + r * cell, (e - q) * cell, cell);
          q = e;
        } else q++;
      }
    }
    c.fill();
  }
  if (flash > 0) {
    c.globalAlpha = alpha * flash * 0.8; c.fillStyle = '#ffffff';
    c.fillRect(x0, y0, bo.w, bo.h);
  }
  c.globalAlpha = 1;
}

function drawBoss(c, g) {
  const bo = g.boss, def = bo.def;
  if (g.state === 'bossdie' && Math.floor(g.t * 20) % 2) return;
  for (const d of bo.decoys) if (d.alive) drawBossShape(c, d.x, bo.y, bo, 0.5 + 0.15 * Math.sin(g.t * 13 + d.ph), 0);
  R.glow(bo.x, bo.y, 190, def.color === PAL.text ? PAL.steel : def.color, 0.35);
  drawBossShape(c, bo.x, bo.y, bo, 1, Math.max(0, bo.flash));
  // 약점 코어
  const p2 = bo.phase2, pulse = 0.5 + 0.5 * Math.sin(g.t * (p2 ? 14 : 6));
  const ccol = p2 ? PAL.warn : PAL.yellow;
  R.glow(bo.x, bo.y + bo.h / 2 - 8, 26 + pulse * 10, ccol, 0.9);
  c.fillStyle = ccol; c.fillRect(bo.x - 9, bo.y + bo.h / 2 - 17, 18, 14);
  if (def.absorb) {
    const open = bo.mouthOpen;
    c.fillStyle = open ? PAL.yellow : '#2a0a14';
    c.globalAlpha = open ? 0.55 + 0.35 * pulse : 0.9;
    c.fillRect(bo.x - 58, bo.y + bo.h / 2 - 56, 116, 34);
    c.globalAlpha = 1;
    if (open) R.glow(bo.x, bo.y + bo.h / 2 - 40, 80, PAL.yellow, 0.6);
  }
  for (let i = 0; i < (def.shields || 0); i++) {
    const [ox, oy] = bo.orbPos(i);
    R.glow(ox, oy, 44, PAL.green, 0.8);
    c.fillStyle = PAL.green; c.beginPath(); c.arc(ox, oy, ORB_R, 0, 6.283); c.fill();
    c.fillStyle = shade(PAL.green, 0.6); c.beginPath(); c.arc(ox - 6, oy - 6, 6, 0, 6.283); c.fill();
    c.strokeStyle = shade(PAL.green, -0.5); c.lineWidth = 3; c.beginPath(); c.arc(ox, oy, ORB_R - 1.5, 0, 6.283); c.stroke();
  }
  // HP 바
  const bw = 520, bx = PF.w / 2 - bw / 2, f = bo.hp / bo.maxHp;
  c.fillStyle = '#05050c'; c.fillRect(bx - 3, 13, bw + 6, 20);
  c.fillStyle = PAL.frame; c.fillRect(bx, 16, bw, 14);
  c.fillStyle = p2 ? PAL.warn : PAL.yellow; c.fillRect(bx, 16, bw * f, 14);
  c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(bx, 16, bw * f, 4);
  R.text(def.name, PF.w / 2, 40, 14, PAL.text, 'c');
}

function drawPaddle(c, g, alpha) {
  const p = g.paddle, e = g.eff;
  if (g.state === 'dying' || g.state === 'over') return;
  const x = p.px + (p.x - p.px) * alpha, w = p.w;
  const sq = p.squash * 4, y = PAD.y + sq, h = PAD.h - sq;
  let cap = WORLDS[g.world].color === PAL.text ? PAL.cyan : WORLDS[g.world].color;
  if (e.L > 0) cap = PAL.red; else if (e.C > 0) cap = PAL.green;
  if (e.R > 0 && Math.floor(g.t * 8) % 2) cap = PAL.warn;
  const stun = p.stun > 0;
  if (stun && Math.floor(g.t * 24) % 2) return;
  R.glow(x, y + h / 2, w * 0.5, cap, 0.3);
  const body = stun ? PAL.warn : '#d8dcec';
  R.rr(x - w / 2, y, w, h, 8); c.fillStyle = shade(body, -0.35); c.fill();
  R.rr(x - w / 2, y, w, h - 4, 8); c.fillStyle = body; c.fill();
  c.fillStyle = '#ffffff'; c.fillRect(x - w / 2 + 22, y + 3, w - 44, 3);
  const cw = 18;
  R.rr(x - w / 2, y, cw, h, 8); c.fillStyle = cap; c.fill();
  R.rr(x + w / 2 - cw, y, cw, h, 8); c.fillStyle = cap; c.fill();
  c.fillStyle = shade(cap, 0.55); c.fillRect(x - w / 2 + 5, y + 3, cw - 10, 3); c.fillRect(x + w / 2 - cw + 5, y + 3, cw - 10, 3);
  if (e.L > 0) { c.fillStyle = '#ffffff'; c.fillRect(x - w / 2 + 7, y - 8, 6, 9); c.fillRect(x + w / 2 - 13, y - 8, 6, 9); }
}

function drawBalls(c, g, alpha) {
  // 콤보가 오를수록 공의 빛이 달아오른다
  const fire = g.eff.F > 0, m = Math.min(8, g.combo);
  const gcol = fire ? PAL.orange : m >= 8 ? PAL.pink : m >= 5 ? PAL.yellow : m >= 3 ? PAL.green : PAL.cyan;
  for (const b of g.balls) {
    if (b.held > 0) continue;
    // 꼬리: 뒤로 갈수록 가늘어지는 빛의 띠
    const tr = b.trail, n = tr.length / 2;
    c.fillStyle = gcol;
    for (let i = 0; i < n - 1; i++) {
      const x0 = tr[i * 2], y0 = tr[i * 2 + 1], x1 = tr[i * 2 + 2], y1 = tr[i * 2 + 3];
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
      if (len < 0.01 || len > 60) continue;           // 순간이동(붙었다 떨어짐) 구간은 건너뛴다
      const nx = -dy / len, ny = dx / len, w0 = BALL_R * (i / n) * 0.95, w1 = BALL_R * ((i + 1) / n) * 0.95;
      c.globalAlpha = ((i + 1) / n) * 0.5;
      c.beginPath();
      c.moveTo(x0 + nx * w0, y0 + ny * w0); c.lineTo(x1 + nx * w1, y1 + ny * w1);
      c.lineTo(x1 - nx * w1, y1 - ny * w1); c.lineTo(x0 - nx * w0, y0 - ny * w0);
      c.fill();
    }
    c.globalAlpha = 1;
    const x = b.px + (b.x - b.px) * alpha, y = b.py + (b.y - b.py) * alpha;
    R.glow(x, y, fire ? 34 : 26, gcol, 0.9);
    c.fillStyle = fire ? PAL.yellow : '#ffffff';
    c.beginPath(); c.arc(x, y, BALL_R, 0, 6.283); c.fill();
    c.fillStyle = fire ? '#ffffff' : shade(gcol, 0.5);
    c.beginPath(); c.arc(x - 2, y - 2, BALL_R * 0.45, 0, 6.283); c.fill();
  }
}

function drawCapsule(c, cap, t) {
  const d = CAPS[cap.type], x = cap.x, y = cap.y;
  const blink = d.bad && Math.floor(t * 7) % 2;
  R.glow(x, y, 34, d.color, 0.65);
  R.rr(x - 23, y - 12, 46, 24, 12); c.fillStyle = d.bad ? '#ffffff' : shade(d.color, -0.5); c.fill();
  R.rr(x - 20, y - 9, 40, 18, 9); c.fillStyle = blink ? '#5a0a1c' : d.color; c.fill();
  c.fillStyle = 'rgba(255,255,255,0.45)'; c.fillRect(x - 13, y - 7, 26, 3);
  R.text(cap.type, x, y - 7, 14, d.bad ? '#ffffff' : '#0b0b1a', 'c');
}

function stars(c, t, n, a) {
  c.fillStyle = '#ffffff';
  for (let i = 0; i < n; i++) {
    const x = (i * 173.1) % PF.w, y = (i * 97.7 + t * (4 + (i % 4) * 5)) % PF.h;
    c.globalAlpha = a * (0.35 + 0.65 * Math.abs(Math.sin(t * 1.1 + i * 1.7)));
    const s = 1.5 + (i % 3);
    c.fillRect(x, y, s, s);
  }
  c.globalAlpha = 1;
}

// 월드마다 다른 배경. 플레이 가독성을 위해 모두 어둡게 유지한다.
const BACKDROPS = [
  // 1 BLUE: 성운과 별, 가끔 지나가는 유성
  (c, g, t, k) => {
    R.glow(200 + Math.sin(t * 0.13) * 120, 300, 420, PAL.blue, 0.16 * k);
    R.glow(640 + Math.cos(t * 0.1) * 100, 620, 380, PAL.purple, 0.16 * k);
    stars(c, t, 70, 0.5);
    const s = (t % 7) / 0.9;
    if (s < 1) {
      const x = 900 - s * 760 - ((Math.floor(t / 7) * 137) % 300), y = 60 + s * 330;
      c.strokeStyle = '#ffffff'; c.lineWidth = 2.5; c.globalAlpha = (1 - s) * 0.7;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 90, y - 39); c.stroke(); c.globalAlpha = 1;
    }
  },
  // 2 GREEN: 흘러내리는 디지털 비
  (c, g, t, k) => {
    c.fillStyle = PAL.green;
    for (let i = 0; i < 26; i++) {
      const x = i * 32 + 12, sp = 90 + ((i * 53) % 110), head = (t * sp + i * 211) % (PF.h + 260) - 60;
      for (let j = 0; j < 9; j++) {
        c.globalAlpha = (1 - j / 9) * 0.3 * k;
        c.fillRect(x, head - j * 22, 8, 14);
      }
    }
    c.globalAlpha = 1;
  },
  // 3 ORANGE: 석양과 원근 그리드
  (c, g, t, k) => {
    R.glow(PF.w / 2, 600, 460, PAL.orange, 0.2 * k);
    c.globalAlpha = 1;
    R.sun(PF.w / 2, 610, 230, PAL.yellow, PAL.pink, 0.19 * k, t, '#06060f');
    const hz = 740;
    c.fillStyle = '#06060f'; c.fillRect(0, hz, PF.w, PF.h - hz);
    c.strokeStyle = PAL.orange; c.lineWidth = 2; c.globalAlpha = 0.24 * k; c.beginPath();
    const ph = (t * 0.6) % 1;
    for (let i = 0; i < 9; i++) { const f = (i + ph) / 9, y = hz + (PF.h - hz) * f * f; c.moveTo(0, y); c.lineTo(PF.w, y); }
    for (let i = -9; i <= 9; i++) { c.moveTo(PF.w / 2 + i * 34, hz); c.lineTo(PF.w / 2 + i * 150, PF.h); }
    c.stroke(); c.globalAlpha = 1;
    stars(c, t, 30, 0.3);
  },
  // 4 PURPLE: 오로라 물결과 떠다니는 빛
  (c, g, t, k) => {
    const cols = [PAL.purple, PAL.cyan, PAL.pink];
    for (let L = 0; L < 3; L++) {
      c.fillStyle = cols[L]; c.globalAlpha = 0.085 * k;
      c.beginPath(); c.moveTo(0, PF.h);
      for (let x = 0; x <= PF.w; x += 32) c.lineTo(x, 330 + L * 170 + Math.sin(x * 0.008 + t * (0.5 + L * 0.2) + L * 2) * 70 + Math.sin(x * 0.021 - t * 0.7) * 26);
      c.lineTo(PF.w, PF.h); c.fill();
    }
    c.globalAlpha = 1;
    for (let i = 0; i < 9; i++) {
      const x = (i * 211 + Math.sin(t * 0.3 + i) * 60) % PF.w, y = PF.h - ((t * (18 + i * 4) + i * 173) % (PF.h + 80));
      R.glow(x, y, 26 + (i % 3) * 12, cols[i % 3], 0.3 * k);
    }
    stars(c, t, 24, 0.25);
  },
  // 5 RED: 아래에서 올라오는 열기와 불티
  (c, g, t, k) => {
    const gr = c.createLinearGradient(0, PF.h - 420, 0, PF.h);
    gr.addColorStop(0, 'rgba(255,23,68,0)'); gr.addColorStop(1, 'rgba(255,60,40,0.3)');
    c.globalAlpha = k * (0.75 + 0.25 * Math.sin(t * 1.7)); c.fillStyle = gr; c.fillRect(0, PF.h - 420, PF.w, 420);
    for (let i = 0; i < 46; i++) {
      const life = ((t * (0.12 + (i % 7) * 0.03) + i * 0.37) % 1);
      const x = (i * 97.3) % PF.w + Math.sin(t * 1.4 + i) * 22, y = PF.h - life * (PF.h * 0.95);
      c.globalAlpha = (1 - life) * 0.55 * k; c.fillStyle = i % 3 ? PAL.orange : PAL.yellow;
      const s = 3 + (i % 4);
      c.fillRect(x, y, s, s);
    }
    c.globalAlpha = 1;
  },
  // 6 MONO: 화면 안쪽에서 다가오는 사각 터널
  (c, g, t, k) => {
    c.strokeStyle = '#ffffff'; c.lineWidth = 2;
    const cx = PF.w / 2, cy = PF.h / 2;
    for (let i = 0; i < 9; i++) {
      const f = ((i + t * 0.22) % 9) / 9, z = f * f;
      c.globalAlpha = Math.min(1, f * 3) * (1 - f) * 0.42 * k;
      c.strokeRect(cx - z * PF.w * 0.62, cy - z * PF.h * 0.62, z * PF.w * 1.24, z * PF.h * 1.24);
    }
    c.globalAlpha = 0.07 * k; c.beginPath();
    c.moveTo(0, 0); c.lineTo(PF.w, PF.h); c.moveTo(PF.w, 0); c.lineTo(0, PF.h); c.stroke();
    c.globalAlpha = 1;
    stars(c, t, 40, 0.35);
  },
];

function drawField(c, g, wc) {
  c.fillStyle = '#06060f'; c.fillRect(0, 0, PF.w, PF.h);
  // 벽돌이 깨질 때마다 배경이 살짝 밝아진다
  BACKDROPS[g.world](c, g, g.t, 1 + g.pulse * 0.5);
  c.globalAlpha = 1;
}

function drawOverlay(c, g) {
  const cx = PF.w / 2, t = g.t, wc = WORLDS[g.world].color;
  const blink = Math.floor(t * 2.5) % 2 === 0;
  if (g.state === 'intro') {
    if (g.boss) {
      if (Math.floor(t * 6) % 2) R.text('WARNING!', cx, 430, 56, PAL.warn, 'c');
      R.text(g.boss.def.name, cx, 520, 35, PAL.text, 'c');
    } else {
      // 옆에서 미끄러져 들어오는 스테이지 띠
      const title = g.mode === 'endless' ? 'ENDLESS' : g.mode === 'daily' ? 'DAILY ' + (g.stage + 1) + '/5' : 'STAGE ' + pad(g.stage + 1, 2);
      const inn = 1 - Math.pow(1 - Math.min(1, g.stateT * 3.2), 3), out = Math.max(0, (g.stateT - 1.02) * 5);
      const off = (1 - inn) * -PF.w + out * out * PF.w;
      c.fillStyle = 'rgba(5,5,14,0.82)'; c.fillRect(off, 572, PF.w, 150);
      c.fillStyle = wc; c.fillRect(off, 572, PF.w, 5); c.fillRect(off, 717, PF.w, 5);
      c.globalAlpha = 0.5;
      for (let x = -40; x < PF.w; x += 40) { c.beginPath(); c.moveTo(off + x, 584); c.lineTo(off + x + 16, 584); c.lineTo(off + x + 28, 578); c.lineTo(off + x + 12, 578); c.fill(); }
      c.globalAlpha = 1;
      R.text(title, cx + off * 0.6, 600, 56, PAL.text, 'c');
      R.text(g.mode === 'endless' ? 'KEEP THE WALL AWAY' : WORLDS[g.world].name, cx - off * 0.3, 676, 21, wc, 'c');
    }
  } else if (g.state === 'play') {
    if (!g.demo && g.balls.some((b) => b.stuck) && blink) {
      const msg = g.eff.C > 0 && g.speedT > 0 ? 'TAP TO RELEASE' : 'TAP OR SPACE TO LAUNCH';
      R.text(msg, cx, 700, 21, PAL.text, 'c');
    }
  } else if (g.state === 'clear' && g.bonus) {
    const b = g.bonus, s = g.stateT, px = cx - 270, py = 280;
    R.panel(px, py, 540, 380, wc);
    R.text(g.bossBeaten != null && g.stage % 5 === 4 && g.mode === 'arcade' ? 'BOSS DEFEATED' : 'STAGE CLEAR', cx, py + 34, 35, PAL.yellow, 'c');
    const rows = [['LIVES', b.life], ['TIME', b.time], ['MAX COMBO', b.combo], ['NO MISS', b.perfect]];
    rows.forEach((r, i) => {
      if (s < 0.35 + i * 0.3) return;
      R.text(r[0], px + 50, py + 112 + i * 46, 21, PAL.dim);
      R.text(r[1] ? '+' + r[1] : '-', px + 490, py + 112 + i * 46, 21, r[1] ? PAL.text : PAL.dim, 'r');
    });
    if (s > 1.7) {
      c.fillStyle = wc; c.fillRect(px + 50, py + 296, 440, 3);
      R.text('BONUS', px + 50, py + 318, 28, PAL.text);
      R.text('+' + b.total, px + 490, py + 318, 28, PAL.yellow, 'r');
    }
    if (b.perfect && s > 1.5 && blink) R.text('PERFECT!', cx, py - 60, 42, PAL.pink, 'c');
  } else if (g.state === 'over') {
    c.fillStyle = 'rgba(5,5,12,0.6)'; c.fillRect(0, 0, PF.w, PF.h);
    R.text('GAME OVER', cx, 420, 70, PAL.warn, 'c');
  }
  // 콤보 구간 달성 문구: 튀어나왔다가 사라진다
  if (g.banner) {
    const bt = g.banner.t, size = 49 * (1 + Math.max(0, 0.18 - bt) * 4);
    c.globalAlpha = Math.min(1, (1.5 - bt) * 2.5);
    R.text(g.banner.str, cx + 3, 624 - bt * 30 + 3, size, '#05050c', 'c');
    R.text(g.banner.str, cx, 624 - bt * 30, size, g.banner.color, 'c');
    c.globalAlpha = 1;
  }
  if (g.demo) {
    R.text('DEMO PLAY', cx, 40, 21, PAL.dim, 'c');
  }
}

// 아케이드 기판 같은 테두리: 금속 틀 + 차례로 켜지는 전구
function drawFrame(c, g, wc) {
  const t = 12;
  c.fillStyle = PAL.frame;
  c.fillRect(-t, -t, PF.w + 2 * t, t); c.fillRect(-t, -t, t, PF.h + t); c.fillRect(PF.w, -t, t, PF.h + t);
  c.fillStyle = shade(PAL.frame, 0.35);
  c.fillRect(-t, -t, PF.w + 2 * t, 3); c.fillRect(-t, -t, 3, PF.h + t); c.fillRect(PF.w, -t, 3, PF.h + t);
  c.fillStyle = shade(PAL.frame, -0.4);
  c.fillRect(-3, -3, PF.w + 6, 3); c.fillRect(-3, -3, 3, PF.h + 3); c.fillRect(PF.w, -3, 3, PF.h + 3);
  const step = Math.floor(g.t * 7), boost = g.pulse * 0.5;
  let i = 0;
  const bulb = (x, y) => {
    const on = (i - step) % 4 === 0 || (i - step) % 4 === -0;
    c.globalAlpha = Math.min(1, (on ? 1 : 0.22) + boost);
    c.fillStyle = on ? '#ffffff' : wc; c.fillRect(x - 3, y - 3, 6, 6);
    if (on) R.glow(x, y, 16, wc === PAL.text ? PAL.steel : wc, 0.9);
    i++;
  };
  for (let y = PF.h - 20; y > 0; y -= 52) bulb(-6, y);
  for (let x = 20; x < PF.w; x += 52) bulb(x, -6);
  for (let y = 20; y < PF.h; y += 52) bulb(PF.w + 6, y);
  c.globalAlpha = 1;
}

function stageLabel(g) {
  if (g.mode === 'arcade') return pad(g.stage + 1, 2) + ' / 30';
  if (g.mode === 'daily') return (g.stage + 1) + ' / 5';
  return 'LEVEL ' + (g.level + 1);
}

function comboColor(m) { return m >= 8 ? PAL.yellow : m >= 5 ? PAL.orange : m >= 2 ? PAL.cyan : PAL.dim; }

function drawPauseBtn(c) {
  const [x, y, w, h] = pauseRect();
  c.fillStyle = PAL.dark; c.fillRect(x, y, w, h);
  c.strokeStyle = PAL.frame; c.lineWidth = 3; c.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  c.fillStyle = PAL.dim;
  c.fillRect(x + w / 2 - 12, y + h / 2 - 12, 8, 24); c.fillRect(x + w / 2 + 4, y + h / 2 - 12, 8, 24);
}

function activeEffects(g) {
  const out = [];
  for (const k in g.eff) if (g.eff[k] > 0) out.push(k);
  return out;
}

// HUD 칸: 어두운 판 + 제목 탭 + 모서리 장식
function box(c, x, y, w, h, title, color) {
  c.fillStyle = 'rgba(10,10,26,0.92)'; c.fillRect(x, y, w, h);
  c.strokeStyle = PAL.frame; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, w - 2, h - 2);
  c.fillStyle = color;
  c.fillRect(x, y, 14, 4); c.fillRect(x, y, 4, 14);
  c.fillRect(x + w - 14, y + h - 4, 14, 4); c.fillRect(x + w - 4, y + h - 14, 4, 14);
  const tw = R.textWidth(title, 14) + 16;
  c.fillStyle = color; c.fillRect(x + 14, y - 9, tw, 20);
  R.text(title, x + 22, y - 6, 14, '#0b0b1a');
}

// 칸으로 나뉜 막대 (진행도, 콤보 등)
function segBar(c, x, y, w, h, n, f, color, off = PAL.dark) {
  const gap = 3, sw = (w - gap * (n - 1)) / n, lit = f * n;
  for (let i = 0; i < n; i++) {
    const k = clamp(lit - i, 0, 1);
    c.fillStyle = off; c.fillRect(x + i * (sw + gap), y, sw, h);
    if (k > 0) { c.fillStyle = typeof color === 'function' ? color(i) : color; c.fillRect(x + i * (sw + gap), y, sw * k, h); }
  }
}

function stageProgress(g) {
  if (g.boss) return 1 - g.boss.hp / g.boss.maxHp;
  if (g.mode === 'endless') return ((g.rowsSpawned - 9) % 10) / 10;
  let left = 0;
  for (const b of g.bricks) if (b.alive && b.type !== 's' && b.type !== 'r') left++;
  return clamp(1 - left / g.totalBricks, 0, 1);
}

const COMBO_SEG = [PAL.cyan, PAL.cyan, PAL.green, PAL.green, PAL.yellow, PAL.yellow, PAL.orange, PAL.pink];

function drawHudLandscape(c, g, wc) {
  const X = HUD.x, Wd = HUD.w, x = X + 18, xr = X + Wd - 18, t = g.t;
  const acc = wc === PAL.text ? PAL.cyan : wc;
  // 로고
  R.blockText('PIXEL', X + Wd / 2, 8, 6, [PAL.cyan, PAL.cyan, PAL.blue, PAL.blue, PAL.purple, PAL.purple, PAL.pink], 'c', X + ((t * 260) % 1400) - 200);
  R.blockText('BREAKER', X + Wd / 2, 54, 6, [PAL.yellow, PAL.yellow, PAL.orange, PAL.orange, PAL.red, PAL.red, PAL.pink], 'c', X + ((t * 260) % 1400) - 200);

  // SCORE
  box(c, X, 112, Wd, 158, 'SCORE', acc);
  R.text(pad(g.dispScore, 7), x, 136, 49, PAL.text);
  R.text('HI', x, 204, 14, PAL.dim);
  R.text(pad(Math.max(Storage.hi(g.mode), g.score), 7), x + 40, 200, 21, PAL.yellow);
  const prev = g.nextLifeAt === 20000 ? 0 : g.nextLifeAt - 50000;
  R.text('1UP', x, 240, 14, PAL.pink);
  segBar(c, x + 58, 240, Wd - 94, 14, 16, clamp((g.score - prev) / (g.nextLifeAt - prev), 0, 1), PAL.pink);

  // STAGE
  box(c, X, 294, Wd, 132, g.mode === 'endless' ? 'ENDLESS' : g.mode === 'daily' ? 'DAILY' : 'STAGE', acc);
  R.text(stageLabel(g), x, 316, 35, PAL.text);
  R.text(g.diff.label, xr, 324, 14, PAL.dim, 'r');
  R.text(g.boss ? 'BOSS: ' + g.boss.def.name : WORLDS[g.world].name, x, 364, 14, g.boss ? PAL.warn : wc);
  segBar(c, x, 392, Wd - 36, 14, 20, stageProgress(g), g.boss ? PAL.warn : acc);

  // LIVES
  box(c, X, 450, Wd, 90, 'LIVES', acc);
  const last = g.lives === 1 && Math.floor(t * 4) % 2 === 0;     // 마지막 목숨은 깜빡인다
  for (let i = 0; i < 5; i++) {
    const on = i < g.lives;
    if (on && !last) R.glow(x + 22 + i * 64, 500, 30, PAL.red, 0.5);
    R.text('$', x + i * 64, 478, 42, on ? (last ? PAL.warn : PAL.red) : PAL.dark);
  }

  // COMBO
  box(c, X, 564, Wd, 122, 'COMBO', acc);
  const m = Math.min(8, Math.max(1, g.combo)), cc = comboColor(m);
  const size = 49 * (1 + g.comboPop * 0.22);
  if (m >= 5) R.glow(x + 60, 618, 80, cc, 0.35 + g.comboPop * 0.3);
  R.text('X' + m, x, 620 - size / 2, size, cc);
  if (m >= 8 && Math.floor(t * 6) % 2) R.text('MAX!', xr, 590, 21, PAL.pink, 'r');
  R.text('BEST ' + g.maxCombo, xr, 624, 14, PAL.dim, 'r');
  segBar(c, x, 656, Wd - 36, 14, 8, g.combo > 0 ? m / 8 : 0, (i) => COMBO_SEG[i]);

  // POWER-UPS
  box(c, X, 710, Wd, 150, 'POWER-UPS', acc);
  const act = activeEffects(g);
  if (!act.length) R.text('- EMPTY -', X + Wd / 2, 778, 14, PAL.frame, 'c');
  act.slice(0, 6).forEach((k, i) => {
    const d = CAPS[k], bx = x + (i % 2) * 172, by = 732 + Math.floor(i / 2) * 42;
    R.rr(bx, by, 40, 26, 13); c.fillStyle = d.color; c.fill();
    R.text(k, bx + 20, by + 6, 14, d.bad ? '#ffffff' : '#0b0b1a', 'c');
    R.text(d.name.slice(0, 7), bx + 48, by + 2, 14, d.bad ? PAL.warn : PAL.text);
    c.fillStyle = PAL.dark; c.fillRect(bx + 48, by + 20, 108, 6);
    c.fillStyle = d.color; c.fillRect(bx + 48, by + 20, 108 * (d.dur ? clamp(g.eff[k] / d.dur, 0, 1) : 1), 6);
  });

  R.text('P: PAUSE', x, V.h - 74, 14, PAL.dim);
  R.text('M: MUTE', x, V.h - 48, 14, PAL.dim);
  drawPauseBtn(c);
}

function drawHudPortrait(c, g, wc) {
  R.panel(12, 10, V.w - 24, PORTRAIT_TOP - 8, PAL.frame);
  R.text('SCORE', 30, 26, 14, PAL.dim);
  R.text(pad(g.dispScore, 7), 30, 48, 35, PAL.text);
  c.fillStyle = PAL.dark; c.fillRect(30, 134, V.w - 60, 5);
  c.fillStyle = g.boss ? PAL.warn : wc; c.fillRect(30, 134, (V.w - 60) * stageProgress(g), 5);
  R.text('HI', 290, 26, 14, PAL.dim);
  R.text(pad(Math.max(Storage.hi(g.mode), g.score), 7), 290, 48, 21, PAL.yellow);
  R.text(g.mode === 'arcade' ? 'STAGE ' + pad(g.stage + 1, 2) : g.mode === 'daily' ? 'DAILY ' + (g.stage + 1) + '/5' : 'LEVEL ' + (g.level + 1), 500, 26, 21, wc);
  for (let i = 0; i < 5; i++) R.text('$', 500 + i * 34, 60, 28, i < g.lives ? PAL.red : PAL.dark);
  const m = Math.min(8, Math.max(1, g.combo));
  R.text('COMBO', 30, 104, 14, PAL.dim);
  R.text('X' + m, 122, 97, 28, comboColor(m));
  activeEffects(g).slice(0, 7).forEach((k, i) => {
    const d = CAPS[k], x = 290 + i * 66, y = 94;
    R.rr(x, y, 52, 26, 13); c.fillStyle = d.color; c.fill();
    R.text(k, x + 26, y + 6, 14, d.bad ? '#ffffff' : '#0b0b1a', 'c');
    if (d.dur) {
      c.fillStyle = PAL.dark; c.fillRect(x, y + 32, 52, 6);
      c.fillStyle = d.color; c.fillRect(x, y + 32, 52 * clamp(g.eff[k] / d.dur, 0, 1), 6);
    }
  });
  drawPauseBtn(c);
}

export function drawGame(g, alpha, hudOn = true) {
  const c = R.ctx, wc = WORLDS[g.world].color;
  if (g.freeze > 0 || g.state !== 'play') alpha = 1;
  c.fillStyle = PAL.bg; c.fillRect(0, 0, V.w, V.h);

  c.save();
  c.translate(PF.x, PF.y);
  c.save();
  c.beginPath(); c.rect(0, 0, PF.w, PF.h); c.clip();
  drawField(c, g, wc);

  if (g.mode === 'endless') {
    c.fillStyle = PAL.warn; c.globalAlpha = 0.35 + 0.25 * Math.sin(g.t * 5);
    for (let x = 0; x < PF.w; x += 48) c.fillRect(x, DANGER_Y, 28, 3);
    c.globalAlpha = 1;
  }
  if (g.eff.B) {
    const p = 0.6 + 0.4 * Math.sin(g.t * 8);
    c.globalAlpha = p; c.fillStyle = PAL.purple; c.fillRect(0, PF.h - 16, PF.w, 5);
    c.globalAlpha = p * 0.5; c.fillStyle = '#ffffff'; c.fillRect(0, PF.h - 15, PF.w, 2);
    c.globalAlpha = 1;
  }

  // 벽돌 그림자 (깊이감)
  c.fillStyle = '#000000'; c.globalAlpha = 0.45;
  for (const b of g.bricks) if (b.alive && b.drop >= 1 && (b.type !== 'g' || g.ghostAlpha(b) > 0.5)) c.fillRect(b.x + 6, b.y + 8, b.w - 2, b.h - 2);
  c.globalAlpha = 1;
  for (const b of g.bricks) if (b.alive) drawBrick(c, b, g);
  // 벽돌 벽을 대각선으로 훑는 빛
  const sweep = (g.t * 520) % 3400 - 300;
  c.fillStyle = '#ffffff';
  for (const b of g.bricks) {
    if (!b.alive || b.drop < 1 || b.type === 'g') continue;
    const d = Math.abs(b.x + b.y * 0.7 - sweep);
    if (d < 90) { c.globalAlpha = (1 - d / 90) * 0.32; c.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2); }
  }
  c.globalAlpha = 1;
  if (g.boss) drawBoss(c, g);

  for (const l of g.lasers) {
    R.glow(l.x, l.y + 10, 22, PAL.red, 0.8);
    c.fillStyle = PAL.red; c.fillRect(l.x - 3, l.y, 6, 22);
    c.fillStyle = '#ffffff'; c.fillRect(l.x - 1, l.y, 2, 22);
  }
  for (const u of g.bullets) {
    R.glow(u.x, u.y, 26, PAL.warn, 0.9);
    c.fillStyle = PAL.warn; c.beginPath(); c.moveTo(u.x, u.y + 10); c.lineTo(u.x + 7, u.y - 6); c.lineTo(u.x - 7, u.y - 6); c.fill();
    c.fillStyle = '#ffffff'; c.fillRect(u.x - 2, u.y - 4, 4, 6);
  }
  for (const cap of g.caps) drawCapsule(c, cap, g.t);
  drawPaddle(c, g, alpha);
  drawBalls(c, g, alpha);

  for (const r of g.rings) {
    const f = r.t / 0.4, big = r.max > 100;
    c.globalAlpha = (1 - f) * (big ? 1 : 0.7); c.strokeStyle = r.color; c.lineWidth = (big ? 8 : 4) * (1 - f) + 1;
    c.beginPath(); c.arc(r.x, r.y, (big ? 20 : 10) + f * r.max, 0, 6.283); c.stroke();
  }
  for (const p of g.parts) {
    c.globalAlpha = Math.min(1, (p.life / p.max) * 1.6);
    c.fillStyle = p.color;
    if (p.vr) {                      // 회전하는 파편
      const cs = Math.cos(p.rot), sn = Math.sin(p.rot), ax = p.w / 2 * cs, ay = p.w / 2 * sn, bx = -p.h / 2 * sn, by = p.h / 2 * cs;
      c.beginPath();
      c.moveTo(p.x - ax - bx, p.y - ay - by); c.lineTo(p.x + ax - bx, p.y + ay - by);
      c.lineTo(p.x + ax + bx, p.y + ay + by); c.lineTo(p.x - ax + bx, p.y - ay + by);
      c.fill();
    } else c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  c.globalAlpha = 1;
  for (const s of g.texts) {
    c.globalAlpha = Math.min(1, s.life * 2.5);
    R.text(s.str, s.x, s.y, s.size, s.color, 'c');
  }
  c.globalAlpha = 1;

  drawOverlay(c, g);
  if (g.flash > 0 && Storage.data.settings.shake) {
    c.globalAlpha = Math.min(0.5, g.flash); c.fillStyle = '#ffffff'; c.fillRect(0, 0, PF.w, PF.h); c.globalAlpha = 1;
  }
  c.restore();
  drawFrame(c, g, wc);
  c.restore();

  if (hudOn) { if (V.portrait) drawHudPortrait(c, g, wc); else drawHudLandscape(c, g, wc); }

  // 세로 화면: 필드 아래 남는 공간을 터치 조작 영역으로 표시한다
  const zy = PF.y + PF.h + 14, zh = V.h - zy - 14;
  if (V.portrait && zh > 70) {
    c.fillStyle = PAL.dark; c.globalAlpha = 0.55; c.fillRect(12, zy, V.w - 24, zh); c.globalAlpha = 1;
    c.strokeStyle = PAL.frame; c.lineWidth = 3; c.strokeRect(13.5, zy + 1.5, V.w - 27, zh - 3);
    const px = PF.x + g.paddle.x;
    c.fillStyle = wc; c.globalAlpha = 0.5; c.fillRect(px - g.paddle.w / 2, zy + 10, g.paddle.w, 6); c.globalAlpha = 1;
    if (zh > 150) {
      R.text('< DRAG HERE TO MOVE >', V.w / 2, zy + zh / 2 - 24, 21, PAL.dim, 'c');
      R.text('TAP TO LAUNCH', V.w / 2, zy + zh / 2 + 14, 14, PAL.dim, 'c');
    }
  }
}
