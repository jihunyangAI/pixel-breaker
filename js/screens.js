// 화면: 타이틀, 메뉴, 플레이, 옵션, 랭킹, 업적, 결과

import { V, PAL, DIFFS, WORLDS, ACHS, BRICK_COLORS } from './config.js';
import { pad, todaySeed, todayLabel } from './util.js';
import { R } from './render.js';
import { Input } from './input.js';
import { Storage } from './storage.js';
import { Audio, Sfx, Music } from './audio.js';
import { App } from './app.js';
import { Game } from './game.js';
import { drawGame, pauseRect } from './gamedraw.js';

const MODES = ['arcade', 'endless', 'daily'];
const u = () => (V.portrait ? 1.4 : 1);       // 세로 화면은 글자와 터치 영역을 키운다
const blink = (hz = 2.5) => Math.floor(App.t * hz) % 2 === 0;

// ---- 공용 메뉴 --------------------------------------------------------------
class Menu {
  constructor(items) { this.items = items; this.sel = 0; this.y = 0; this.size = 28; this.gap = 58; }
  place(y, size = 28, gap = 58) { this.y = y; this.size = size * u(); this.gap = gap * u(); return this; }
  at(x, y) {
    if (Math.abs(x - V.w / 2) > 380) return -1;
    const i = Math.floor((y - this.y + (this.gap - this.size) / 2) / this.gap);
    return i >= 0 && i < this.items.length ? i : -1;
  }
  run(it, dir) {
    if (it.adj) { it.adj(dir || 1); Sfx.tick(); }
    else if (it.act && !dir) { Sfx.select(); it.act(); }
  }
  event(ev) {
    const n = this.items.length;
    if (ev.t === 'key') {
      if (ev.k === 'up') { this.sel = (this.sel + n - 1) % n; Sfx.move(); }
      else if (ev.k === 'down') { this.sel = (this.sel + 1) % n; Sfx.move(); }
      else if (ev.k === 'left') this.run(this.items[this.sel], -1);
      else if (ev.k === 'right') this.run(this.items[this.sel], 1);
      else if (ev.k === 'ok') this.run(this.items[this.sel], 0);
    } else if (ev.t === 'move') {
      const i = this.at(Input.mx, Input.my);
      if (i >= 0 && i !== this.sel) { this.sel = i; if (!Input.touch) Sfx.move(); }
    } else if (ev.t === 'click') {
      const i = this.at(ev.x, ev.y);
      if (i >= 0) { this.sel = i; this.run(this.items[i], 0); }
    }
  }
  draw() {
    const cx = V.w / 2;
    this.items.forEach((it, i) => {
      const label = typeof it.label === 'function' ? it.label() : it.label;
      const y = this.y + i * this.gap, on = i === this.sel;
      if (on) {
        // 선택 항목은 노란 벽돌 위에 올린다
        const w = R.textWidth(label, this.size), c = R.ctx, s = this.size;
        const bx = cx - w / 2 - s, by = y - s * 0.42, bw = w + s * 2, bh = s * 1.84, e = Math.max(3, s * 0.12);
        R.glow(cx, y + s / 2, bw * 0.6, PAL.yellow, 0.35);
        c.fillStyle = PAL.yellow; c.fillRect(bx, by, bw, bh);
        c.fillStyle = '#fff3b0'; c.fillRect(bx, by, bw, e); c.fillRect(bx, by, e, bh);
        c.fillStyle = '#a8780a'; c.fillRect(bx, by + bh - e, bw, e); c.fillRect(bx + bw - e, by, e, bh);
        const a = Math.sin(App.t * 9) * s * 0.18;
        R.text('>', bx - s * 0.9 + a, y, s, PAL.yellow, 'c');
        R.text('<', bx + bw + s * 0.9 - a, y, s, PAL.yellow, 'c');
        R.text(label, cx, y, s, '#0b0b1a', 'c');
      } else R.text(label, cx, y, this.size, it.color || PAL.text, 'c');
    });
  }
}

function header(title, color = PAL.cyan) {
  R.text(title, V.w / 2, 70 * u(), 56, color, 'c');
  const c = R.ctx;
  c.fillStyle = color; c.fillRect(V.w / 2 - 240, 70 * u() + 74, 480, 4);
}
const footer = (s) => R.text(s, V.w / 2, V.h - 46, 14, PAL.dim, 'c');
const cursor = (v) => { R.canvas.style.cursor = v; };

// ---- 타이틀 -----------------------------------------------------------------
const titleMemo = { phase: 'logo', sel: 0 };   // 다른 화면에서 돌아와도 메뉴 위치 유지

export class TitleScreen {
  get phase() { return titleMemo.phase; }
  set phase(v) { titleMemo.phase = v; }
  enter() {
    cursor('default');
    this.idle = 0; this.demo = null;
    Sfx.on = true;
    Music.play('title');
    const sel = titleMemo.sel;
    this.menu = new Menu([
      { label: 'ARCADE', act: () => App.go(new DiffScreen('arcade')) },
      { label: 'ENDLESS', act: () => App.go(new DiffScreen('endless')) },
      { label: 'DAILY ' + todayLabel(), act: () => App.go(new PlayScreen({ mode: 'daily', diff: 'normal', seed: todaySeed() })) },
      { label: 'RANKING', act: () => App.go(new RankScreen('arcade')) },
      { label: 'AWARDS', act: () => App.go(new AwardsScreen()) },
      { label: 'OPTIONS', act: () => App.go(new OptionsScreen(() => App.go(this))) },
    ]);
    this.menu.sel = sel;
  }
  stopDemo() { this.demo = null; this.idle = 0; Sfx.on = true; }
  event(ev) {
    if (ev.t === 'blur') return;
    if (this.demo) { if (ev.t === 'key' || ev.t === 'click') this.stopDemo(); return; }
    if (ev.t !== 'move') this.idle = 0;
    if (this.phase === 'logo') {
      if ((ev.t === 'key' && ev.k === 'ok') || ev.t === 'click') { this.phase = 'menu'; Sfx.select(); }
      return;
    }
    if (ev.t === 'key' && ev.k === 'back') { this.phase = 'logo'; return; }
    this.menu.event(ev);
    titleMemo.sel = this.menu.sel;
  }
  update(dt) {
    if (this.demo) {
      this.demo.update(dt);
      if (this.demo.done || this.demo.t > 45) this.stopDemo();
      return;
    }
    this.idle += dt;
    if (this.idle > 14) {            // 방치하면 데모 플레이
      Sfx.on = false;
      this.phase = 'logo';
      this.demo = new Game({ mode: 'arcade', diff: 'normal', stage: Math.floor(Math.random() * 4), demo: true });
    }
  }
  draw(alpha) {
    const cx = V.w / 2, t = App.t;
    if (this.demo) {
      drawGame(this.demo, alpha);
      R.panel(cx - 250, V.h / 2 - 70, 500, 140, PAL.yellow);
      R.text('PIXEL BREAKER', cx, V.h / 2 - 40, 35, PAL.yellow, 'c');
      if (blink()) R.text('PRESS START', cx, V.h / 2 + 22, 21, PAL.text, 'c');
      return;
    }
    R.backdrop(t, PAL.purple);
    const ly = V.portrait ? 150 : 96, cell = V.portrait ? 18 : 16;
    const bob = Math.sin(t * 1.6) * 6;
    R.glow(cx, ly + cell * 8, 520, PAL.purple, 0.35);
    const shine = cx - 600 + ((t * 620) % 2600);
    // 로고 그림자 + 빛이 훑고 지나가는 블록 글자
    R.ctx.globalAlpha = 0.5;
    R.blockText('PIXEL', cx + 8, ly + bob + 10, cell, ['#05050c']);
    R.blockText('BREAKER', cx + 8, ly + cell * 8.5 + bob + 10, cell, ['#05050c']);
    R.ctx.globalAlpha = 1;
    R.blockText('PIXEL', cx, ly + bob, cell, [PAL.cyan, PAL.cyan, PAL.blue, PAL.blue, PAL.purple, PAL.purple, PAL.pink], 'c', shine);
    R.blockText('BREAKER', cx, ly + cell * 8.5 + bob, cell, [PAL.yellow, PAL.yellow, PAL.orange, PAL.orange, PAL.red, PAL.red, PAL.pink], 'c', shine);
    const my = ly + cell * 17 + 40;
    R.ctx.fillStyle = 'rgba(8,8,20,0.8)'; R.ctx.fillRect(cx - 200, my - 12, 400, 45);
    R.text('HI-SCORE ' + pad(Storage.hi('arcade'), 7), cx, my, 21, PAL.cyan, 'c');
    if (this.phase === 'logo') {
      if (blink()) R.text(Input.touch ? 'TAP TO START' : 'PRESS START', cx, my + 130 * u(), 35, PAL.text, 'c');
      R.text('SPACE / ENTER / CLICK', cx, my + 200 * u(), 14, PAL.dim, 'c');
    } else {
      this.menu.place(my + 76, 28, 56);
      R.panel(cx - 290, this.menu.y - 34, 580, this.menu.gap * 6 + 34);
      this.menu.draw();
    }
    // 장식 벽돌 줄
    const c = R.ctx;
    for (let i = 0; i < Math.ceil(V.w / 64); i++) {
      c.fillStyle = BRICK_COLORS[(i + Math.floor(t * 2)) % 7];
      c.globalAlpha = 0.85; c.fillRect(i * 64 + 2, V.h - 18, 60, 10);
    }
    c.globalAlpha = 1;
  }
}

// ---- 난이도 / 월드 선택 -----------------------------------------------------
class DiffScreen {
  constructor(mode) { this.mode = mode; }
  enter() {
    cursor('default');
    const go = (diff) => {
      if (this.mode === 'arcade' && Storage.data.maxWorld > 1) App.go(new WorldScreen(diff));
      else App.go(new PlayScreen({ mode: this.mode, diff }));
    };
    this.menu = new Menu([
      ...Object.keys(DIFFS).map((k) => ({ label: DIFFS[k].label, key: k, act: () => go(k) })),
      { label: 'BACK', color: PAL.dim, act: () => App.go(new TitleScreen()) },
    ]);
    this.menu.sel = 1;
  }
  event(ev) {
    if (ev.t === 'key' && ev.k === 'back') { App.go(new TitleScreen()); return; }
    this.menu.event(ev);
  }
  update() {}
  draw() {
    R.backdrop(App.t, PAL.blue);
    header(this.mode.toUpperCase());
    R.text('SELECT DIFFICULTY', V.w / 2, 70 * u() + 110, 21, PAL.dim, 'c');
    this.menu.place(V.h * 0.36, 35, 76);
    R.panel(V.w / 2 - 330, this.menu.y - 40, 660, this.menu.gap * 4 + 110);
    this.menu.draw();
    const it = this.menu.items[this.menu.sel];
    if (it.key) R.text(DIFFS[it.key].desc, V.w / 2, this.menu.y + this.menu.gap * 4 + 20, 14, PAL.cyan, 'c');
  }
}

class WorldScreen {
  constructor(diff) { this.diff = diff; }
  enter() {
    cursor('default');
    const items = [];
    for (let w = 0; w < Storage.data.maxWorld; w++) {
      items.push({ label: 'WORLD ' + (w + 1) + ' - ' + WORLDS[w].name, color: WORLDS[w].color, act: () => App.go(new PlayScreen({ mode: 'arcade', diff: this.diff, stage: w * 5 })) });
    }
    items.push({ label: 'BACK', color: PAL.dim, act: () => App.go(new DiffScreen('arcade')) });
    this.menu = new Menu(items);
  }
  event(ev) {
    if (ev.t === 'key' && ev.k === 'back') { App.go(new DiffScreen('arcade')); return; }
    this.menu.event(ev);
  }
  update() {}
  draw() {
    R.backdrop(App.t, PAL.green);
    header('START FROM');
    this.menu.place(V.h * 0.3, 21, 58);
    R.panel(V.w / 2 - 360, this.menu.y - 36, 720, this.menu.gap * this.menu.items.length + 36);
    this.menu.draw();
    footer('SCORE STARTS AT ZERO');
  }
}

// ---- 플레이 -----------------------------------------------------------------
export class PlayScreen {
  constructor(opts) {
    this.opts = opts;
    this.game = new Game(opts);
    this.paused = false;
    this.menu = new Menu([
      { label: 'RESUME', act: () => this.setPause(false) },
      { label: 'RESTART', act: () => App.go(new PlayScreen(this.opts)) },
      { label: 'OPTIONS', act: () => App.go(new OptionsScreen(() => App.go(this))) },
      { label: 'QUIT', color: PAL.dim, act: () => App.go(new TitleScreen()) },
    ]);
  }
  enter() { cursor(this.paused ? 'default' : 'none'); Sfx.on = true; }
  setPause(v) {
    if (this.game.done) return;
    this.paused = v; this.menu.sel = 0;
    cursor(v ? 'default' : 'none');
  }
  event(ev) {
    if (ev.t === 'blur') { if (!this.paused) this.setPause(true); return; }
    if (this.paused) {
      if (ev.t === 'key' && (ev.k === 'back' || ev.k === 'pause')) { this.setPause(false); return; }
      this.menu.event(ev);
      return;
    }
    if (ev.t === 'key') {
      if (ev.k === 'back' || ev.k === 'pause') { this.setPause(true); Sfx.move(); }
      else if (ev.k === 'ok') this.game.actQ = true;
    } else if (ev.t === 'click') {
      const [x, y, w, h] = pauseRect();
      if (ev.x >= x && ev.x <= x + w && ev.y >= y && ev.y <= y + h) { this.setPause(true); Sfx.move(); }
      else if (!ev.touch) this.game.actQ = true;     // 터치는 끌기와 구분해 'tap' 에서만 발사
    } else if (ev.t === 'tap') {
      const [x, y, w, h] = pauseRect();
      if (!(ev.x >= x && ev.x <= x + w && ev.y >= y && ev.y <= y + h)) this.game.actQ = true;
    }
  }
  update(dt) {
    if (this.paused) return;
    const g = this.game;
    g.update(dt);
    if (g.done) App.go(new ResultScreen(g));
  }
  shake() {
    const s = this.game.shake;
    if (s <= 0 || this.paused || !Storage.data.settings.shake) return null;
    return [(Math.random() - 0.5) * s, (Math.random() - 0.5) * s];
  }
  aberr() { return this.paused ? 0 : this.game.aberr; }
  draw(alpha) {
    drawGame(this.game, this.paused ? 1 : alpha);
    if (this.paused) {
      const c = R.ctx;
      c.fillStyle = 'rgba(5,5,12,0.72)'; c.fillRect(0, 0, V.w, V.h);
      R.text('PAUSED', V.w / 2, V.h * 0.22, 70, PAL.yellow, 'c');
      this.menu.place(V.h * 0.42, 35, 78);
      R.panel(V.w / 2 - 280, this.menu.y - 44, 560, this.menu.gap * 4 + 44);
      this.menu.draw();
    }
  }
}

// ---- 옵션 -------------------------------------------------------------------
class OptionsScreen {
  constructor(back) { this.back = back; }
  enter() {
    cursor('default');
    const s = Storage.data.settings;
    const bar = (v) => '#'.repeat(Math.round(v * 10)).padEnd(10, '-');
    const vol = (key) => (d) => {
      let v = Math.round(s[key] * 10) + d;
      if (v > 10) v = 0; if (v < 0) v = 10;      // 탭으로만 조절할 때를 위해 순환
      s[key] = v / 10; Audio.setVol(s.music, s.sfx); Storage.save();
    };
    this.menu = new Menu([
      { label: () => 'MUSIC  ' + bar(s.music), adj: vol('music') },
      { label: () => 'SOUND  ' + bar(s.sfx), adj: vol('sfx') },
      { label: () => 'SCREEN FX  ' + ['OFF', 'LOW', 'HIGH'][s.fx], adj: (d) => { s.fx = (s.fx + d + 3) % 3; Storage.save(); } },
      { label: () => 'SHAKE + FLASH  ' + (s.shake ? 'ON' : 'OFF'), adj: () => { s.shake = !s.shake; Storage.save(); } },
      { label: 'BACK', color: PAL.dim, act: () => this.back() },
    ]);
  }
  event(ev) {
    if (ev.t === 'key' && ev.k === 'back') { this.back(); return; }
    this.menu.event(ev);
  }
  update() {}
  draw() {
    R.backdrop(App.t, PAL.orange);
    header('OPTIONS', PAL.orange);
    this.menu.place(V.h * 0.3, 21, 70);
    R.panel(V.w / 2 - 370, this.menu.y - 44, 740, this.menu.gap * 5 + 44);
    this.menu.draw();
    footer(Input.touch ? 'TAP TO CHANGE' : 'LEFT / RIGHT OR CLICK TO CHANGE');
  }
}

// ---- 랭킹 -------------------------------------------------------------------
class RankScreen {
  constructor(mode, hi = -1) { this.mode = mode; this.hi = hi; }
  enter() { cursor('default'); Music.play('title'); }
  event(ev) {
    const i = MODES.indexOf(this.mode);
    if (ev.t === 'key') {
      if (ev.k === 'left') { this.mode = MODES[(i + 2) % 3]; this.hi = -1; Sfx.move(); }
      else if (ev.k === 'right') { this.mode = MODES[(i + 1) % 3]; this.hi = -1; Sfx.move(); }
      else if (ev.k === 'ok' || ev.k === 'back') App.go(new TitleScreen());
    } else if (ev.t === 'click') {
      const ty = 70 * u() + 100;
      if (ev.y > ty - 20 && ev.y < ty + 50) {
        const k = Math.floor((ev.x - (V.w / 2 - 330)) / 220);
        if (k >= 0 && k < 3) { this.mode = MODES[k]; this.hi = -1; Sfx.move(); }
      } else App.go(new TitleScreen());
    }
  }
  update() {}
  draw() {
    const cx = V.w / 2;
    R.backdrop(App.t, PAL.pink);
    header('RANKING', PAL.pink);
    const ty = 70 * u() + 100;
    MODES.forEach((m, k) => R.text(m, cx - 220 + k * 220, ty, 21, m === this.mode ? PAL.yellow : PAL.dim, 'c'));
    const list = Storage.data.ranks[this.mode], y0 = ty + 76, gap = Math.min(58, (V.h - y0 - 90) / 10);
    R.panel(cx - 400, y0 - 26, 800, gap * 10 + 30);
    for (let i = 0; i < 10; i++) {
      const e = list[i], y = y0 + i * gap;
      const col = i === this.hi ? (blink(5) ? PAL.yellow : PAL.text) : i === 0 ? PAL.cyan : PAL.text;
      R.text(pad(i + 1, 2), cx - 360, y, 21, PAL.dim);
      if (e) {
        R.text(e.name, cx - 280, y, 21, col);
        R.text(pad(e.score, 7), cx - 150, y, 21, col);
        R.text(e.info || '', cx + 360, y + 4, 14, PAL.dim, 'r');
      } else R.text('---', cx - 280, y, 21, PAL.dark);
    }
    footer(Input.touch ? 'TAP A MODE TO SWITCH - TAP ELSEWHERE TO EXIT' : 'LEFT / RIGHT: MODE    ENTER: BACK');
  }
}

// ---- 업적 -------------------------------------------------------------------
class AwardsScreen {
  enter() { cursor('default'); }
  event(ev) {
    if ((ev.t === 'key' && (ev.k === 'ok' || ev.k === 'back')) || ev.t === 'click') App.go(new TitleScreen());
  }
  update() {}
  draw() {
    const cx = V.w / 2;
    R.backdrop(App.t, PAL.yellow);
    header('AWARDS', PAL.yellow);
    const got = ACHS.filter((a) => Storage.data.ach[a.id]).length;
    const y0 = 70 * u() + 120, gap = Math.min(60, (V.h - y0 - 80) / 12);
    R.text(got + ' / ' + ACHS.length, cx, y0 - 34, 21, PAL.dim, 'c');
    R.panel(cx - 410, y0, 820, gap * 12 + 20);
    ACHS.forEach((a, i) => {
      const on = !!Storage.data.ach[a.id], y = y0 + 18 + i * gap;
      R.text(on ? '*' : '-', cx - 380, y, 21, on ? PAL.yellow : PAL.dark);
      R.text(a.name, cx - 340, y, 21, on ? PAL.text : PAL.dim);
      R.text(a.desc, cx + 390, y + 4, 14, on ? PAL.cyan : PAL.dim, 'r');
    });
    footer(Input.touch ? 'TAP TO EXIT' : 'ENTER: BACK');
  }
}

// ---- 결과 + 이름 입력 -------------------------------------------------------
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

class ResultScreen {
  constructor(game) {
    this.g = game;
    this.win = game.done === 'win';
    this.entry = Storage.qualifies(game.mode, game.score);
    this.name = (Storage.data.name || 'AAA').split('');
    this.cur = 0; this.t = 0;
  }
  get typing() { return this.entry; }
  enter() { cursor('default'); if (this.win) Sfx.clear(); }
  info() {
    const g = this.g;
    if (g.mode === 'arcade') return 'ST ' + pad(Math.min(g.stage + 1, 30), 2) + ' ' + g.diff.label;
    if (g.mode === 'endless') return 'LV ' + (g.level + 1) + ' ' + g.diff.label;
    return todayLabel();
  }
  confirm() {
    const name = this.name.join('');
    Storage.data.name = name;
    const idx = Storage.addRank(this.g.mode, { name, score: this.g.score, info: this.info() });
    Sfx.select();
    App.go(new RankScreen(this.g.mode, idx));
  }
  spin(d) {
    const i = ALPHA.indexOf(this.name[this.cur]);
    this.name[this.cur] = ALPHA[(i + d + ALPHA.length) % ALPHA.length];
    Sfx.tick();
  }
  letterX(i) { return V.w / 2 + (i - 1) * 130; }
  event(ev) {
    if (this.t < 0.6) return;
    if (!this.entry) {
      if ((ev.t === 'key' && (ev.k === 'ok' || ev.k === 'back')) || ev.t === 'click') App.go(new RankScreen(this.g.mode));
      return;
    }
    const ly = V.h * 0.6;
    if (ev.t === 'char') {
      if (ev.c === 'BACK') { this.cur = Math.max(0, this.cur - 1); return; }
      this.name[this.cur] = ev.c; this.cur = Math.min(2, this.cur + 1); Sfx.tick();
    } else if (ev.t === 'key' && !ev.letter) {
      if (ev.k === 'up') this.spin(1);
      else if (ev.k === 'down') this.spin(-1);
      else if (ev.k === 'left') this.cur = Math.max(0, this.cur - 1);
      else if (ev.k === 'right') this.cur = Math.min(2, this.cur + 1);
      else if (ev.k === 'ok') this.confirm();
    } else if (ev.t === 'click') {
      for (let i = 0; i < 3; i++) {
        if (Math.abs(ev.x - this.letterX(i)) < 60 && ev.y > ly - 80 && ev.y < ly + 170) {
          this.cur = i; this.spin(ev.y < ly + 45 ? 1 : -1);
          return;
        }
      }
      if (ev.y > ly + 190 && ev.y < ly + 290 && Math.abs(ev.x - V.w / 2) < 200) this.confirm();
    }
  }
  update(dt) { this.t += dt; }
  draw() {
    const cx = V.w / 2, g = this.g;
    R.backdrop(App.t, this.win ? PAL.yellow : PAL.red);
    const title = this.win ? (g.mode === 'daily' ? 'DAILY CLEAR!' : 'ALL CLEAR!') : 'GAME OVER';
    R.text(title, cx, V.h * 0.1, V.portrait && title.length > 9 ? 56 : 70, this.win ? PAL.yellow : PAL.warn, 'c');
    if (this.win && g.mode === 'arcade') R.text('EVERY LAST BRICK IS GONE. THANK YOU FOR PLAYING!', cx, V.h * 0.1 + 96, 14, PAL.text, 'c');
    R.panel(cx - 330, V.h * 0.25, 660, 190);
    R.text('SCORE', cx - 290, V.h * 0.25 + 30, 21, PAL.dim);
    R.text(pad(g.score, 7), cx + 290, V.h * 0.25 + 22, 35, PAL.text, 'r');
    R.text('MAX COMBO', cx - 290, V.h * 0.25 + 90, 21, PAL.dim);
    R.text(g.maxCombo, cx + 290, V.h * 0.25 + 90, 21, PAL.cyan, 'r');
    R.text('REACHED', cx - 290, V.h * 0.25 + 136, 21, PAL.dim);
    R.text(this.info(), cx + 290, V.h * 0.25 + 136, 21, PAL.cyan, 'r');
    if (this.entry) {
      const ly = V.h * 0.6;
      R.text('NEW RECORD! ENTER YOUR NAME', cx, ly - 120, 21, PAL.yellow, 'c');
      for (let i = 0; i < 3; i++) {
        const x = this.letterX(i), on = i === this.cur;
        R.text('^', x, ly - 64, 35, on ? PAL.yellow : PAL.dim, 'c');
        R.text(this.name[i], x, ly, 84, on && blink(4) ? PAL.yellow : PAL.text, 'c');
        R.text('~', x, ly + 112, 35, on ? PAL.yellow : PAL.dim, 'c');
      }
      R.panel(cx - 130, ly + 200, 260, 76, PAL.yellow);
      R.text('OK', cx, ly + 220, 35, PAL.yellow, 'c');
    } else if (blink()) R.text(Input.touch ? 'TAP TO CONTINUE' : 'PRESS START', cx, V.h * 0.66, 28, PAL.text, 'c');
  }
}
