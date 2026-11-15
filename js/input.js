// 키보드·마우스·터치 통합 입력

import { R } from './render.js';
import { Audio } from './audio.js';

const KEYS = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  KeyA: 'left', KeyD: 'right', KeyW: 'up', KeyS: 'down',
  Space: 'ok', Enter: 'ok', NumpadEnter: 'ok', Escape: 'back', KeyP: 'pause', KeyM: 'mute',
};

let down = null;   // 현재 눌린 포인터의 시작 위치와 시각

export const Input = {
  mx: 440, my: 480,
  touch: false,    // 마지막 포인터가 터치였는지
  left: false, right: false, held: false,
  usingMouse: true,
  events: [],
  any: false,      // 마지막 확인 이후 입력이 있었는지 (데모 종료용)

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      Audio.unlock(); this.any = true;
      const k = KEYS[e.code];
      if (k) {
        if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
        if (k === 'left') { this.left = true; this.usingMouse = false; }
        if (k === 'right') { this.right = true; this.usingMouse = false; }
        if (e.code === 'Space') this.held = true;
        const nav = k === 'left' || k === 'right' || k === 'up' || k === 'down';
        if (!e.repeat || nav) this.events.push({ t: 'key', k, letter: e.code.startsWith('Key') });
      }
      if (!e.repeat && e.key.length === 1 && /[a-z0-9]/i.test(e.key)) this.events.push({ t: 'char', c: e.key.toUpperCase() });
      if (!e.repeat && e.code === 'Backspace') this.events.push({ t: 'char', c: 'BACK' });
    });
    window.addEventListener('keyup', (e) => {
      const k = KEYS[e.code];
      if (k === 'left') this.left = false;
      if (k === 'right') this.right = false;
      if (e.code === 'Space') this.held = false;
    });

    const pos = (e) => {
      const [x, y] = R.toLogical(e.clientX, e.clientY);
      this.mx = x; this.my = y; this.usingMouse = true;
      this.touch = e.pointerType === 'touch';
    };
    // iOS 는 터치 종료/클릭 시점에만 오디오 시작을 허용하는 경우가 있다
    for (const ev of ['touchend', 'click']) window.addEventListener(ev, () => Audio.unlock(), { passive: true });
    canvas.addEventListener('pointermove', (e) => { pos(e); this.events.push({ t: 'move' }); });
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Audio.unlock(); this.any = true;
      pos(e); this.held = true;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
      this.events.push({ t: 'click', x: this.mx, y: this.my, touch: this.touch });
    });
    const up = () => { this.held = false; };
    // 터치는 "짧게 눌렀다 뗀 것"만 탭으로 본다. 끌기 위해 손가락을 대는 것과 구분하기 위해서다.
    canvas.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch' && down && performance.now() - down.t < 300 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 14) {
        this.events.push({ t: 'tap', x: this.mx, y: this.my });
      }
      down = null;
    });
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const blur = () => {
      this.left = this.right = this.held = false;
      this.events.push({ t: 'blur' });
    };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { blur(); Audio.suspend(); } else Audio.resume();
    });
  },
};
