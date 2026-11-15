// 진입점: 초기화와 게임 루프 (120Hz 고정 물리 + 보간 렌더)

import { STEP, V, PAL } from './config.js';
import { R } from './render.js';
import { FX } from './fx.js';
import { Input } from './input.js';
import { Storage } from './storage.js';
import { Audio } from './audio.js';
import { App } from './app.js';
import { TitleScreen } from './screens.js';

Storage.load();
const canvas = document.getElementById('game');
R.init(canvas);
Input.init(canvas);
Audio.setVol(Storage.data.settings.music, Storage.data.settings.sfx);
App.go(new TitleScreen());

function drawToasts(dt) {
  const ts = App.toasts;
  if (!ts.length) return;
  const s = ts[0];
  s.t += dt;
  if (s.t > 3.2) { ts.shift(); return; }
  const k = Math.min(1, s.t * 5, (3.2 - s.t) * 5), w = 440, x = V.w / 2 - w / 2, y = -90 + k * 110;
  R.panel(x, y, w, 78, PAL.yellow);
  R.text(s.title, V.w / 2, y + 14, 14, PAL.yellow, 'c');
  R.text(s.text, V.w / 2, y + 40, 21, PAL.text, 'c');
}

// 화면 전환: 블록이 대각선으로 걷히며 새 화면이 드러난다
function drawWipe() {
  const w = App.wipe;
  if (w <= 0) return;
  const c = R.ctx, s = 80, cols = Math.ceil(V.w / s), rows = Math.ceil(V.h / s);
  for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
    const k = Math.min(1, (w * 1.7 - (q + r) / (cols + rows)) * 2.4);
    if (k <= 0) continue;
    const z = s * k + 1;
    c.fillStyle = (q + r) % 2 ? PAL.bg : PAL.dark;
    c.fillRect(q * s + (s - z) / 2, r * s + (s - z) / 2, z, z);
    if (k < 1) { c.fillStyle = PAL.purple; c.fillRect(q * s + (s - z) / 2, r * s + (s - z) / 2, z, 3); }
  }
}

let last = performance.now(), acc = 0, slow = 0, period = 1 / 30;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.1) dt = 0.1;                 // 탭 전환 등으로 멈췄다 돌아온 경우

  // 프레임이 계속 밀리면 블룸 품질만 한 단계 낮춘다.
  // 기준은 이 화면에서 관측된 가장 짧은 프레임 간격(주사율)이다. 50Hz 모니터를 느리다고 오판하지 않기 위해서다.
  if (dt > 0.004 && dt < period) period = dt;
  if (dt > period * 1.3 + 0.001) slow++; else if (slow > 0) slow--;
  if (slow > 90) { FX.lower(); slow = 0; }

  const evs = Input.events.splice(0);
  for (const ev of evs) {
    if (ev.t === 'key' && ev.k === 'mute') { if (!App.screen.typing) Audio.toggleMute(); continue; }
    App.screen.event(ev);
  }

  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 14) { App.screen.update(STEP); App.t += STEP; acc -= STEP; n++; }
  if (n === 14) acc = 0;

  const sh = App.screen.shake ? App.screen.shake() : null;
  const shx = sh ? sh[0] : 0, shy = sh ? sh[1] : 0, a = acc / STEP, scr = App.screen;
  R.begin(shx, shy);
  if (App.wipe > 0) App.wipe = Math.max(0, App.wipe - dt * 2.6);
  try {
    scr.draw(a);
    drawWipe();
    drawToasts(dt);
    if (Audio.muted) R.text('MUTE', V.w - 16, V.h - 26, 14, PAL.warn, 'r');
  } finally { R.end(); }     // 그리기 중 예외가 나도 캔버스 상태 스택이 쌓이지 않게 한다
  FX.capture(() => { scr.draw(a); drawWipe(); drawToasts(0); }, shx, shy);
  FX.post(scr.aberr ? scr.aberr() : 0);
}
requestAnimationFrame(frame);

// 디버그/테스트용 핸들
window.__pb = { App, Storage, R, FX, Input };
