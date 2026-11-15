// 화면 전환, 토스트, 업적 해제

import { ACHS } from './config.js';
import { Storage } from './storage.js';
import { Sfx } from './audio.js';

export const App = {
  screen: null,
  t: 0,
  toasts: [],
  wipe: 0,          // 화면 전환 효과 진행도 (1 -> 0)
  go(screen) {
    this.screen = screen;
    this.wipe = 1;
    if (screen.enter) screen.enter();
  },
  toast(title, text) { this.toasts.push({ title, text, t: 0 }); },
};

export function unlock(id) {
  if (Storage.data.ach[id]) return;
  const a = ACHS.find((x) => x.id === id);
  if (!a) return;
  Storage.data.ach[id] = true;
  Storage.save();
  App.toast('AWARD UNLOCKED', a.name);
  Sfx.ach();
}
