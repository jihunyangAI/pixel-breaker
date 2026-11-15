// 플레이 로직: 물리, 벽돌, 파워업, 콤보, 점수, 모드별 규칙

import { PF, PAD, BW, BH, COLS, BRICK_TOP, BALL_R, DANGER_Y, DIFFS, PAL, BRICK_COLORS, BRICK_SCORES, CAPS, CAP_GOOD, CAP_BAD } from './config.js';
import { clamp, mulberry32 } from './util.js';
import { STAGES, dailyStage, endlessRow } from './levels.js';
import { Boss } from './boss.js';
import { Sfx, Music } from './audio.js';
import { unlock } from './app.js';
import { Storage } from './storage.js';
import { Input } from './input.js';

const DEG = Math.PI / 180;
const MAX_BALLS = 9, MAX_PARTS = 420;
const HARD2 = '#2f7fb0', HARD3 = '#6a4fd0';

// 원-사각형 겹침. 겹치면 거리 제곱, 아니면 -1. 최근접점까지의 벡터는 HDX/HDY 에 남는다.
let HDX = 0, HDY = 0;
function circRect(bx, by, r, x, y, w, h) {
  const cx = bx < x ? x : bx > x + w ? x + w : bx;
  const cy = by < y ? y : by > y + h ? y + h : by;
  HDX = bx - cx; HDY = by - cy;
  const d = HDX * HDX + HDY * HDY;
  return d < r * r ? d : -1;
}

export class Game {
  constructor(o) {
    this.mode = o.mode;
    this.diffKey = o.diff || 'normal';
    this.diff = DIFFS[this.diffKey];
    this.demo = !!o.demo;
    this.seed = o.seed ?? ((Math.random() * 4294967296) >>> 0);
    this.rng = mulberry32(this.seed);
    this.score = 0; this.lives = this.diff.lives;
    this.stage = o.stage || 0; this.level = 0;
    this.nextLifeAt = 20000;
    this.t = 0; this.done = null;
    this.parts = []; this.pool = []; this.texts = []; this.rings = [];
    this.shake = 0; this.freeze = 0; this.flash = 0; this.aberr = 0;
    this.maxCombo = 0; this.actQ = false; this.cleanT = 0;
    this.dispScore = 0; this.pulse = 0; this.comboPop = 0; this.banner = null; this.totalBricks = 1;
    this.paddle = { x: PF.w / 2, px: PF.w / 2, w: PAD.w, vx: 0, kv: 0, squash: 0, stun: 0 };
    this.eff = { E: 0, L: 0, F: 0, C: 0, S: 0, T: 0, X: 0, R: 0, B: 0 };
    if (this.mode === 'daily') {
      this.dailyRows = [];
      for (let i = 0; i < 5; i++) this.dailyRows.push(dailyStage(this.rng, i));
    }
    this.loadStage();
  }

  get world() {
    if (this.mode === 'arcade') return Math.min(5, Math.floor(this.stage / 5));
    if (this.mode === 'daily') return (this.seed + this.stage) % 6;
    return Math.floor(this.level / 2) % 6;
  }
  get stageCount() { return this.mode === 'arcade' ? STAGES.length : 5; }
  ach(id) { if (!this.demo) unlock(id); }

  // ---- 스테이지 -----------------------------------------------------------
  loadStage() {
    this.bricks = []; this.balls = []; this.caps = []; this.lasers = []; this.bullets = []; this.booms = [];
    this.boss = null; this.bonus = null;
    this.clearEff();
    this.combo = 0; this.stageMaxCombo = 0; this.chain = 0;
    this.stageTime = 0; this.speedT = 0; this.missed = false; this.laserCd = 0;
    let rows;
    if (this.mode === 'arcade') {
      const d = STAGES[this.stage];
      rows = d.rows;
      if (d.boss != null) this.boss = new Boss(d.boss, this);
    } else if (this.mode === 'daily') rows = this.dailyRows[this.stage];
    else {
      rows = [];
      this.rowsSpawned = 0;
      for (let i = 0; i < 9; i++) rows.push(endlessRow(this.rng, 0, this.rowsSpawned++));
      this.endTop = BRICK_TOP - 3 * BH;      // 맨 윗줄은 화면 밖에서 시작
    }
    const y0 = this.mode === 'endless' ? this.endTop : BRICK_TOP;
    rows.forEach((r, ri) => {
      for (let c = 0; c < COLS; c++) {
        const ch = r[c];
        if (ch && ch !== '.') this.addBrick(ch, ri, c, y0 + ri * BH).drop = -(13 - ri) * 0.1;
      }
    });
    this.totalBricks = Math.max(1, this.bricks.filter((b) => b.type !== 's' && b.type !== 'r').length);
    this.state = 'intro'; this.stateT = 0;
    this.spawnBall();
    if (this.boss) Sfx.warn();
    if (!this.demo) Music.play(this.boss ? 'boss' : 'w' + (this.world + 1));
  }

  addBrick(ch, row, col, y) {
    const b = {
      x: col * BW, y: y ?? BRICK_TOP + row * BH, w: BW, h: BH, row, col,
      type: 'n', color: PAL.text, hp: 1, maxHp: 1, alive: true, score: 100,
      vx: 0, respawn: 0, flash: 0, drop: 0, paid: false, off: ((row + col) % 2) * 2,
    };
    if (ch >= '1' && ch <= '7') { const i = +ch - 1; b.color = BRICK_COLORS[i]; b.score = BRICK_SCORES[i]; }
    else if (ch === 'H') { b.type = 'h'; b.hp = b.maxHp = 2; b.color = HARD2; b.score = 150; }
    else if (ch === 'I') { b.type = 'h'; b.hp = b.maxHp = 3; b.color = HARD3; b.score = 200; }
    else if (ch === 'S') { b.type = 's'; b.hp = b.maxHp = Infinity; b.color = PAL.steel; b.score = 0; }
    else if (ch === 'B') { b.type = 'b'; b.color = PAL.warn; b.score = 100; }
    else if (ch === 'G') { b.type = 'g'; b.color = PAL.cyan; b.score = 130; }
    else if (ch === 'M') { b.type = 'm'; b.color = PAL.text; b.score = 130; b.vx = (row % 2 ? -1 : 1) * 90; }
    else if (ch === 'R') { b.type = 'r'; b.color = PAL.green; b.score = 100; }
    else if (ch === 'T') { b.type = 't'; b.color = PAL.gold; b.score = 200; }
    this.bricks.push(b);
    return b;
  }

  cellFree(row, col) {
    for (const b of this.bricks) if (b.row === row && (b.alive || b.respawn > 0) && Math.abs(b.x - col * BW) < BW) return false;
    const x = col * BW, y = BRICK_TOP + row * BH;
    for (const b of this.balls) if (circRect(b.x, b.y, BALL_R + 6, x, y, BW, BH) >= 0) return false;
    return true;
  }

  // 유령 벽돌: 4초 주기 (2초 실체, 2초 소멸)
  ghostAlpha(b) {
    const ph = (this.t + b.off) % 4;
    if (ph < 1.8) return 1;
    if (ph < 2.1) return 1 - (ph - 1.8) / 0.3;
    if (ph < 3.7) return 0;
    return (ph - 3.7) / 0.3;
  }
  solid(b) { return b.alive && b.drop >= 1 && (b.type !== 'g' || this.ghostAlpha(b) > 0.5); }

  clearEff() { for (const k in this.eff) this.eff[k] = 0; }

  spawnBall() {
    this.balls.push({ x: this.paddle.x, y: PAD.y - BALL_R, px: this.paddle.x, py: PAD.y - BALL_R, vx: 0, vy: 0, stuck: true, off: 0, stuckT: 0, noHit: 0, held: 0, dead: false, trail: [] });
  }

  ballSpeed() {
    let base;
    // speedT 는 목숨을 잃으면 0 으로 돌아간다 (stageTime 은 시간 보너스용으로 계속 흐른다)
    if (this.mode === 'endless') base = 500 + Math.min(this.level * 14, 240) + Math.min(this.speedT * 1.5, 80);
    else base = 500 + this.world * 18 + Math.min(this.speedT * 5, 250);
    let m = this.diff.speed;
    if (this.eff.S > 0) m *= 0.68;
    if (this.eff.X > 0) m *= 1.35;
    return base * m;
  }

  // ---- 효과 헬퍼 ----------------------------------------------------------
  burst(x, y, color, n, spd = 260) {
    for (let i = 0; i < n && this.parts.length < MAX_PARTS; i++) {
      const p = this.pool.pop() || {};
      const a = Math.random() * 6.283, v = spd * (0.25 + Math.random() * 0.9);
      p.x = x; p.y = y; p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - 80;
      p.life = p.max = 0.35 + Math.random() * 0.4; p.size = 3 + Math.random() * 5; p.color = color;
      p.w = p.h = p.size; p.rot = 0; p.vr = 0;
      this.parts.push(p);
    }
  }
  // 벽돌 파편: 회전하며 떨어지는 조각
  shards(x, y, color, n) {
    for (let i = 0; i < n && this.parts.length < MAX_PARTS; i++) {
      const p = this.pool.pop() || {};
      const a = Math.random() * 6.283, v = 120 + Math.random() * 260;
      p.x = x + (Math.random() - 0.5) * 40; p.y = y + (Math.random() - 0.5) * 16;
      p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v - 140;
      p.life = p.max = 0.5 + Math.random() * 0.45; p.color = color;
      p.w = 8 + Math.random() * 12; p.h = 5 + Math.random() * 7; p.size = p.w;
      p.rot = a; p.vr = (Math.random() - 0.5) * 22;
      this.parts.push(p);
    }
  }
  ring(x, y, color, max) { if (this.rings.length < 14) this.rings.push({ x, y, t: 0, color, max }); }
  say(x, y, str, color = PAL.text, size = 21) {
    if (this.texts.length < 24) this.texts.push({ x: clamp(x, 60, PF.w - 60), y, str, color, size, life: 0.9 });
  }

  addScore(n) {
    this.score += n;
    while (this.score >= this.nextLifeAt) {
      this.nextLifeAt += 50000;
      if (this.lives < 5) { this.lives++; Sfx.oneUp(); this.say(this.paddle.x, PAD.y - 50, '1UP', PAL.pink, 28); }
    }
    if (this.mode === 'endless' && this.score >= 100000) this.ach('marathon');
  }

  // 공을 사각형에서 튕긴다. 0 없음 / 1 왼쪽 / 2 오른쪽 / 3 윗면 / 4 아랫면
  bounce(b, x, y, w, h) {
    if (circRect(b.x, b.y, BALL_R, x, y, w, h) < 0) return 0;
    let nx = 0, ny = 0;
    if (HDX === 0 && HDY === 0) {           // 중심이 안에 들어옴: 가장 얕은 축으로 밀어낸다
      const l = b.x - x, r = x + w - b.x, t = b.y - y, bo = y + h - b.y, m = Math.min(l, r, t, bo);
      if (m === t) ny = -1; else if (m === bo) ny = 1; else if (m === l) nx = -1; else nx = 1;
    } else if (Math.abs(HDX) > Math.abs(HDY)) nx = HDX > 0 ? 1 : -1;
    else ny = HDY > 0 ? 1 : -1;
    if (nx) { if (b.vx * nx < 0) b.vx = -b.vx; b.x = nx > 0 ? x + w + BALL_R : x - BALL_R; return nx < 0 ? 1 : 2; }
    if (b.vy * ny < 0) b.vy = -b.vy;
    b.y = ny > 0 ? y + h + BALL_R : y - BALL_R;
    return ny < 0 ? 3 : 4;
  }

  // ---- 벽돌 ---------------------------------------------------------------
  damage(b, dmg, src) {
    if (b.type === 's' && src !== 'fire') {
      if (src !== 'bomb') { Sfx.steel(); b.flash = 1; }
      return false;
    }
    b.hp -= dmg; b.flash = 1;
    if (b.hp <= 0 || src === 'fire') { this.kill(b, src); return true; }
    Sfx.hard();
    return false;
  }

  kill(b, src) {
    b.alive = false;
    const cx = b.x + BW / 2, cy = b.y + BH / 2;
    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    if (this.combo > this.stageMaxCombo) this.stageMaxCombo = this.combo;
    if (this.combo >= 8) this.ach('combo');
    const mult = Math.min(8, this.combo);
    if (!b.paid && b.score) {
      this.addScore(Math.round(b.score * mult * this.diff.score));
      if (mult > 1) this.say(cx, cy - 10, 'X' + mult, mult >= 8 ? PAL.yellow : PAL.text, mult >= 5 ? 21 : 14);
    }
    Sfx.brick(this.combo);
    this.shards(cx, cy, b.color, 7); this.burst(cx, cy, '#ffffff', 4, 200);
    this.ring(cx, cy, b.color, 46);
    this.pulse = 1; this.comboPop = 1;
    const ms = { 5: ['GREAT!', PAL.cyan], 8: ['MAX COMBO!', PAL.yellow], 15: ['UNSTOPPABLE!', PAL.orange], 25: ['LEGENDARY!', PAL.pink] }[this.combo];
    if (ms) this.banner = { str: ms[0], color: ms[1], t: 0 };
    if (b.type === 'b') {
      this.chain = src === 'bomb' ? this.chain + 1 : 1;
      if (this.chain >= 5) this.ach('chain');
      this.booms.push({ x: cx, y: cy, t: 0.08 });
    }
    if (b.type === 'r') b.respawn = 8;
    if (!b.paid && (b.type === 't' || this.rng() < (this.boss ? 0.2 : 0.12))) this.dropCap(cx, cy);
    b.paid = true;   // 재생 벽돌은 처음 한 번만 점수와 캡슐을 준다
  }

  explode(bm) {
    Sfx.bomb();
    this.shake = Math.max(this.shake, 11); this.freeze = 0.045; this.aberr = 1; this.flash = 0.22;
    this.burst(bm.x, bm.y, PAL.orange, 26, 420); this.burst(bm.x, bm.y, PAL.yellow, 12, 300);
    this.rings.push({ x: bm.x, y: bm.y, t: 0, color: PAL.yellow, max: 130 });
    for (const b of this.bricks) {
      if (!b.alive || b.drop < 1) continue;
      if (Math.abs(b.x + BW / 2 - bm.x) < BW * 1.5 && Math.abs(b.y + BH / 2 - bm.y) < BH * 1.5) this.damage(b, 2, 'bomb');
    }
  }

  dropCap(x, y) {
    if (this.caps.length >= 4) return;
    const r = this.rng();
    let type;
    if (r < 0.03 && this.lives < 5) type = '$';
    else if (r < 0.27) type = CAP_BAD[Math.floor(this.rng() * CAP_BAD.length)];
    else {
      type = CAP_GOOD[Math.floor(this.rng() * CAP_GOOD.length)];
      if (type === 'B' && this.eff.B) type = 'M';
    }
    this.caps.push({ x: clamp(x, 26, PF.w - 26), y, type, t: 0 });
  }

  applyCap(type) {
    const d = CAPS[type], e = this.eff, p = this.paddle;
    if (d.bad) {
      Sfx.capBad();
      this.addScore(500);
      this.say(p.x, PAD.y - 40, d.name + ' +500', PAL.warn);
      if (!this.demo) { Storage.data.badCaps++; Storage.save(); if (Storage.data.badCaps >= 10) this.ach('dare'); }
    } else {
      Sfx.capGood();
      this.addScore(100);
      this.say(p.x, PAD.y - 40, d.name, d.color);
    }
    if (d.dur) e[type] = d.dur;
    if (type === 'E') e.T = 0;
    if (type === 'T') e.E = 0;
    if (type === 'S') e.X = 0;
    if (type === 'X') e.S = 0;
    if (type === 'B') e.B = 1;
    if (type === '$') { if (this.lives < 5) this.lives++; Sfx.oneUp(); }
    if (type === 'M') this.multi();
  }

  multi() {
    const sp = this.ballSpeed();
    for (const b of this.balls.slice()) {
      if (b.dead || b.held > 0) continue;
      for (const a of [-0.45, 0.45]) {
        if (this.balls.length >= MAX_BALLS) return;
        let vx, vy;
        if (b.stuck) { vx = Math.sin(a * 1.3) * sp; vy = -Math.cos(a * 1.3) * sp; }
        else { const c = Math.cos(a), s = Math.sin(a); vx = b.vx * c - b.vy * s; vy = b.vx * s + b.vy * c; }
        const nb = { x: b.x, y: b.y, px: b.x, py: b.y, vx, vy, stuck: false, off: 0, stuckT: 0, noHit: 0, held: 0, dead: false, trail: [] };
        this.fixAngle(nb, sp);
        this.balls.push(nb);
      }
    }
  }

  // 속도를 맞추고, 수평에 가까운 각도를 막는다 (최소 15도)
  fixAngle(b, sp) {
    const len = Math.hypot(b.vx, b.vy) || 1;
    b.vx *= sp / len; b.vy *= sp / len;
    const minVy = sp * 0.2588;
    if (Math.abs(b.vy) < minVy) {
      b.vy = (b.vy < 0 ? -1 : 1) * minVy;
      b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(sp * sp - minVy * minVy);
    }
  }

  launch(b) {
    const p = this.paddle, sp = this.ballSpeed();
    let ang;
    if (Math.abs(b.off) > 2) ang = clamp(b.off / (p.w / 2), -1, 1) * 60;
    else { ang = (this.rng() * 2 - 1) * 25; if (Math.abs(ang) < 6) ang = ang < 0 ? -6 : 6; }
    b.stuck = false; b.stuckT = 0; b.noHit = 0;
    b.vx = Math.sin(ang * DEG) * sp; b.vy = -Math.cos(ang * DEG) * sp;
    Sfx.launch();
  }

  // ---- 메인 업데이트 ------------------------------------------------------
  update(dt) {
    this.t += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 38);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.6);
    if (this.aberr > 0) this.aberr = Math.max(0, this.aberr - dt * 3.5);
    if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt * 3);
    if (this.comboPop > 0) this.comboPop = Math.max(0, this.comboPop - dt * 5);
    this.dispScore += (this.score - this.dispScore) * Math.min(1, dt * 9);      // 점수판 숫자가 굴러 올라간다
    if (this.score - this.dispScore < 1) this.dispScore = this.score;
    if (this.banner) { this.banner.t += dt; if (this.banner.t > 1.5) this.banner = null; }
    if (this.freeze > 0) { this.freeze -= dt; return; }
    this.updateFx(dt);
    this.stateT += dt;
    const act = this.actQ; this.actQ = false;

    switch (this.state) {
      case 'intro':
        this.updatePaddle(dt);
        for (const b of this.bricks) if (b.drop < 1) b.drop = Math.min(1, b.drop + dt * 2.2);
        for (const b of this.balls) this.stickBall(b);
        if (this.boss) this.boss.move(dt);
        if (this.stateT > (this.boss ? 2.4 : 1.25)) { this.state = 'play'; this.stateT = 0; for (const b of this.bricks) b.drop = 1; }
        break;
      case 'play':
        this.sim(dt, act);
        break;
      case 'dying':
        if (this.stateT > 1.1) {
          if (this.lives <= 0) this.gameOver();
          else { this.spawnBall(); this.state = 'play'; this.stateT = 0; }
        }
        break;
      case 'bossdie': {
        const bo = this.boss;
        if (Math.floor(this.stateT * 9) !== Math.floor((this.stateT - dt) * 9)) {
          const x = bo.x + (Math.random() - 0.5) * bo.w, y = bo.y + (Math.random() - 0.5) * bo.h;
          this.burst(x, y, bo.def.color, 22, 420); this.burst(x, y, PAL.yellow, 10, 300);
          this.shake = Math.max(this.shake, 8); Sfx.bossDie();
        }
        if (this.stateT > 2.3) {
          this.flash = 0.5; this.aberr = 1;
          this.addScore(Math.round(5000 * (bo.idx + 1) * this.diff.score));
          this.boss = null; this.bossBeaten = bo.idx;
          this.stageClear();
        }
        break;
      }
      case 'clear':
        this.updatePaddle(dt);
        if (this.stateT > 4.5 || (act && this.stateT > 1.2) || (this.demo && this.stateT > 1.5)) this.nextStage();
        break;
      case 'over':
        if (this.stateT > 2.4 || (act && this.stateT > 1)) this.done = 'over';
        break;
    }
  }

  updateFx(dt) {
    const ps = this.parts;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) { this.pool.push(p); ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const s = this.texts[i];
      s.life -= dt; s.y -= 46 * dt;
      if (s.life <= 0) this.texts.splice(i, 1);
    }
    const rs = this.rings;
    for (let i = rs.length - 1; i >= 0; i--) { rs[i].t += dt; if (rs[i].t > 0.4) rs.splice(i, 1); }
  }

  updatePaddle(dt) {
    const p = this.paddle, e = this.eff;
    p.px = p.x;
    const tw = PAD.w * (e.E > 0 ? 1.5 : e.T > 0 ? 0.6 : 1);
    p.w += (tw - p.w) * Math.min(1, dt * 12);
    if (p.squash > 0) p.squash = Math.max(0, p.squash - dt * 6);
    const rev = e.R > 0;
    if (p.stun > 0) p.stun -= dt;
    else if (this.demo) this.demoAI(dt);
    else if (Input.usingMouse) {
      let tx = Input.mx - PF.x;
      if (rev) tx = PF.w - tx;
      p.x += clamp(tx - p.x, -6000 * dt, 6000 * dt);   // 사실상 1:1, 순간이동만 완화
    } else {
      let ax = (Input.right ? 1 : 0) - (Input.left ? 1 : 0);
      if (rev) ax = -ax;
      p.kv += (ax * 980 - p.kv) * Math.min(1, dt * 18);
      p.x += p.kv * dt;
    }
    p.x = clamp(p.x, p.w / 2, PF.w - p.w / 2);
    p.vx += ((p.x - p.px) / dt - p.vx) * 0.3;
  }

  demoAI(dt) {
    const p = this.paddle;
    let best = null;
    for (const b of this.balls) if (!b.stuck && !b.held && b.vy > 0 && (!best || b.y > best.y)) best = b;
    let tx = p.x;
    if (best) {
      const tt = (PAD.y - best.y) / Math.max(60, best.vy), span = PF.w - 2 * BALL_R;
      let x = best.x + best.vx * tt - BALL_R;
      x = ((x % (2 * span)) + 2 * span) % (2 * span);
      if (x > span) x = 2 * span - x;
      tx = x + BALL_R + Math.sin(this.t * 1.7) * p.w * 0.3;
    } else {
      const any = this.balls.find((b) => !b.stuck);
      if (any) tx = any.x;
    }
    p.x += clamp(tx - p.x, -820 * dt, 820 * dt);
    for (const b of this.balls) if (b.stuck && b.stuckT > 0.7) this.actQ = true;
  }

  stickBall(b) {
    const p = this.paddle;
    b.off = clamp(b.off, -p.w / 2 + 6, p.w / 2 - 6);
    b.x = b.px = p.x + b.off; b.y = b.py = PAD.y - BALL_R;
    b.stuckT += 1 / 120;
    if (b.trail.length) b.trail.length = 0;      // 붙어 있는 동안에는 꼬리를 남기지 않는다
  }

  sim(dt, act) {
    const e = this.eff, p = this.paddle;
    let flying = false;
    for (const b of this.balls) if (!b.stuck) flying = true;
    if (flying) { this.stageTime += dt; this.speedT += dt; }
    for (const k in e) if (k !== 'B' && e[k] > 0) e[k] = Math.max(0, e[k] - dt);

    this.updatePaddle(dt);

    if (act) for (const b of this.balls) if (b.stuck) this.launch(b);
    this.laserCd -= dt;
    if (e.L > 0 && (act || Input.held || this.demo) && this.laserCd <= 0 && p.stun <= 0) {
      this.laserCd = 0.26;
      this.lasers.push({ x: p.x - p.w / 2 + 10, y: PAD.y }, { x: p.x + p.w / 2 - 10, y: PAD.y });
      Sfx.laser();
    }

    this.updateBricks(dt, flying);
    if (this.state !== 'play') return;

    for (let i = this.booms.length - 1; i >= 0; i--) {
      const bm = this.booms[i];
      bm.t -= dt;
      if (bm.t <= 0) { this.booms.splice(i, 1); this.explode(bm); }
    }
    if (!this.booms.length) this.chain = 0;

    if (this.boss) { this.boss.move(dt); if (flying && this.boss.alive) this.boss.attack(dt, this); }

    const sp = this.ballSpeed();
    for (const b of this.balls) this.updateBall(b, dt, sp);
    if (this.state !== 'play') return;      // 보스 격파 등으로 상태가 바뀜

    // 캡슐
    for (let i = this.caps.length - 1; i >= 0; i--) {
      const c = this.caps[i];
      c.y += 190 * dt; c.t += dt;
      if (c.y + 11 >= PAD.y && c.y - 11 <= PAD.y + PAD.h && Math.abs(c.x - p.x) < p.w / 2 + 22) { this.caps.splice(i, 1); this.applyCap(c.type); }
      else if (c.y > PF.h + 30) this.caps.splice(i, 1);
    }

    // 레이저
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      const l = this.lasers[i];
      l.y -= 1100 * dt;
      let gone = l.y < 0;
      if (!gone) for (const b of this.bricks) {
        if (this.solid(b) && l.x >= b.x && l.x <= b.x + BW && l.y >= b.y && l.y <= b.y + BH) {
          this.damage(b, 1, 'laser'); this.burst(l.x, l.y, PAL.red, 3, 140); gone = true; break;
        }
      }
      const bo = this.boss;
      if (!gone && bo && bo.alive && Math.abs(l.x - bo.x) < bo.w / 2 && Math.abs(l.y - bo.y) < bo.h / 2) { bo.hit(1, this, l.x, l.y); gone = true; }
      if (gone) this.lasers.splice(i, 1);
      if (this.state !== 'play') return;
    }

    // 보스 탄환: 맞으면 패들이 잠깐 마비된다 (목숨은 깎이지 않는다)
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const u = this.bullets[i];
      u.x += u.vx * dt; u.y += u.vy * dt;
      if (u.x < 8 || u.x > PF.w - 8) u.vx = -u.vx;
      if (u.y > PAD.y - 6 && u.y < PAD.y + PAD.h && Math.abs(u.x - p.x) < p.w / 2 + 8) {
        this.bullets.splice(i, 1);
        p.stun = 0.7; Sfx.stun(); this.shake = Math.max(this.shake, 7);
        this.burst(u.x, PAD.y, PAL.warn, 12); this.say(p.x, PAD.y - 40, 'STUNNED!', PAL.warn);
      } else if (u.y > PF.h + 20) this.bullets.splice(i, 1);
    }

    // 공 정리
    for (let i = this.balls.length - 1; i >= 0; i--) if (this.balls[i].dead) this.balls.splice(i, 1);
    if (this.balls.length >= 5) this.ach('juggler');
    if (!this.balls.length) { this.loseLife(); return; }

    // 클리어 판정: 강철과 재생 벽돌은 제외
    if (this.mode !== 'endless' && !this.boss) {
      let left = false;
      for (const b of this.bricks) if (b.alive && b.type !== 's' && b.type !== 'r') { left = true; break; }
      if (!left && !this.booms.length) this.stageClear();
    }
  }

  updateBricks(dt, flying) {
    this.cleanT += dt;
    if (this.cleanT > 1) { this.cleanT = 0; this.bricks = this.bricks.filter((b) => b.alive || b.respawn > 0); }
    for (const b of this.bricks) {
      if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 7);
      if (b.drop < 1) b.drop = Math.min(1, b.drop + dt * 2.2);
      if (!b.alive) {
        if (b.respawn > 0) {
          b.respawn -= dt;
          if (b.respawn <= 0) {
            let clear = true;
            for (const ball of this.balls) if (circRect(ball.x, ball.y, BALL_R + 4, b.x, b.y, BW, BH) >= 0) clear = false;
            if (clear) { b.alive = true; b.hp = 1; b.flash = 1; } else b.respawn = 0.3;
          }
        }
        continue;
      }
      if (b.type === 'm') {
        const nx = b.x + b.vx * dt;
        let hit = nx < 0 || nx + BW > PF.w;
        if (!hit) for (const o of this.bricks) {
          if (o !== b && o.row === b.row && (o.alive || o.respawn > 0) && nx < o.x + BW && nx + BW > o.x) { hit = true; break; }
        }
        if (hit) b.vx = -b.vx; else b.x = nx;
      }
    }

    if (this.mode === 'endless') {
      let low = 0;
      for (const b of this.bricks) if (b.alive && b.y + BH > low) low = b.y + BH;
      if (low >= DANGER_Y) { this.crushed(); return; }
      if (flying) {
        let v = Math.min(13, 3 + this.level * 0.55);
        if (low < BRICK_TOP + BH * 4) v = Math.max(v * 6, 24);      // 화면이 비면 빨리 채운다
        const dy = v * dt;
        for (const b of this.bricks) b.y += dy;
        this.endTop += dy;
      }
      while (this.endTop >= 0) {
        this.endTop -= BH;
        const row = endlessRow(this.rng, this.level, this.rowsSpawned);
        for (let c = 0; c < COLS; c++) if (row[c] !== '.') this.addBrick(row[c], -this.rowsSpawned, c, this.endTop).drop = 1;
        this.rowsSpawned++;
        const lv = Math.floor((this.rowsSpawned - 9) / 10);
        if (lv > this.level) {
          this.level = lv;
          this.say(PF.w / 2, 420, 'LEVEL ' + (lv + 1), PAL.yellow, 35);
          Sfx.oneUp();
          if (!this.demo) Music.play('w' + (this.world + 1));
        }
      }
    }
  }

  updateBall(b, dt, sp) {
    b.px = b.x; b.py = b.y;
    if (b.dead) return;
    if (b.stuck) { this.stickBall(b); return; }
    if (b.held > 0) {                       // 보스에게 삼켜짐
      const bo = this.boss;
      b.held -= dt;
      if (bo) { b.x = b.px = bo.x; b.y = b.py = bo.y + bo.h / 2 - 12; }
      if (b.held <= 0 || !bo) {
        const a = (this.rng() * 2 - 1) * 45 * DEG;
        b.vx = Math.sin(a) * sp; b.vy = Math.cos(a) * sp;
        if (bo) b.y = b.py = bo.y + bo.h / 2 + BALL_R + 2;
        b.held = 0; Sfx.launch();
      }
      return;
    }
    b.noHit += dt;
    if (b.noHit > 7) {                      // 강철 사이에 갇힌 공을 살짝 틀어 준다
      const a = (this.rng() < 0.5 ? -1 : 1) * 12 * DEG, c = Math.cos(a), s = Math.sin(a);
      const vx = b.vx * c - b.vy * s; b.vy = b.vx * s + b.vy * c; b.vx = vx;
      b.noHit = 3;
    }
    this.fixAngle(b, sp);
    const n = Math.max(1, Math.ceil((sp * dt) / (BALL_R * 0.75)));
    const sdt = dt / n;
    for (let i = 0; i < n; i++) {
      this.stepBall(b, sdt);
      if (b.dead || b.stuck || b.held > 0 || this.state !== 'play') break;
    }
    if (!b.stuck && !b.held) this.fixAngle(b, sp);
    if (this.eff.F > 0 && Math.random() < 0.35) this.burst(b.x, b.y, Math.random() < 0.5 ? PAL.orange : PAL.yellow, 1, 90);   // 불꽃 꼬리
    const tr = b.trail;
    tr.push(b.x, b.y);
    if (tr.length > 28) tr.splice(0, 2);
  }

  stepBall(b, dt) {
    const p = this.paddle, e = this.eff;
    b.x += b.vx * dt; b.y += b.vy * dt;

    // 벽
    if (b.x < BALL_R) { b.x = BALL_R; b.vx = Math.abs(b.vx); Sfx.wall(); this.burst(0, b.y, '#ffffff', 3, 130); }
    else if (b.x > PF.w - BALL_R) { b.x = PF.w - BALL_R; b.vx = -Math.abs(b.vx); Sfx.wall(); this.burst(PF.w, b.y, '#ffffff', 3, 130); }
    if (b.y < BALL_R) { b.y = BALL_R; b.vy = Math.abs(b.vy); Sfx.wall(); this.burst(b.x, 0, '#ffffff', 3, 130); }

    // 바닥
    if (b.vy > 0 && b.y > PF.h - 16 - BALL_R && e.B) {
      b.y = PF.h - 16 - BALL_R; b.vy = -Math.abs(b.vy);
      e.B = 0; Sfx.barrier(); this.flash = 0.15; this.burst(b.x, PF.h - 14, PAL.purple, 22, 320);
      this.say(b.x, PF.h - 60, 'SAVED!', PAL.purple);
      return;
    }
    if (b.y > PF.h + BALL_R * 3) { b.dead = true; return; }

    // 패들: 맞은 위치로 반사각 결정 (가장자리 60도) + 패들 이동 방향 보정
    if (b.vy > 0 && b.y + BALL_R >= PAD.y && b.y < PAD.y + PAD.h * 0.7 && Math.abs(b.x - p.x) <= p.w / 2 + BALL_R * 0.8) {
      b.y = PAD.y - BALL_R;
      this.combo = 0; b.noHit = 0; p.squash = 1;
      if (e.C > 0) { b.stuck = true; b.off = b.x - p.x; b.stuckT = 0; b.vx = b.vy = 0; Sfx.paddle(); return; }
      const off = clamp((b.x - p.x) / (p.w / 2), -1, 1);
      const ang = clamp(off * 60 + clamp(p.vx / 900, -1, 1) * 10, -72, 72) * DEG;
      const sp = Math.hypot(b.vx, b.vy);
      b.vx = Math.sin(ang) * sp; b.vy = -Math.cos(ang) * sp;
      Sfx.paddle(); this.burst(b.x, PAD.y, PAL.cyan, 4, 150);
      return;
    }

    // 보스
    if (this.boss && this.boss.alive && this.boss.collide(b, this)) { b.noHit = 0; return; }

    // 벽돌: 한 스텝에 가장 가까운 하나만 처리해 모서리 이중 반사를 막는다
    let best = null, bd = Infinity;
    const bricks = this.bricks;
    for (let i = 0; i < bricks.length; i++) {
      const k = bricks[i];
      if (!k.alive || b.y + BALL_R < k.y || b.y - BALL_R > k.y + BH || b.x + BALL_R < k.x || b.x - BALL_R > k.x + BW) continue;
      if (!this.solid(k)) continue;
      const d = circRect(b.x, b.y, BALL_R, k.x, k.y, BW, BH);
      if (d >= 0 && d < bd) { bd = d; best = k; }
    }
    if (!best) return;
    if (e.F > 0) { this.damage(best, 9, 'fire'); b.noHit = 0; return; }   // 파이어볼: 관통
    this.bounce(b, best.x, best.y, BW, BH);
    if (best.type !== 's') b.noHit = 0;
    this.damage(best, 1, 'ball');
  }

  // ---- 진행 ---------------------------------------------------------------
  loseLife() {
    const p = this.paddle;
    this.lives--; this.missed = true;
    this.clearEff();
    this.caps = []; this.lasers = []; this.bullets = []; this.booms = [];
    this.combo = 0; this.chain = 0; this.speedT = 0;
    this.state = 'dying'; this.stateT = 0;
    Sfx.lose();
    this.shake = 16; this.aberr = 1; this.flash = 0.2;
    this.burst(p.x, PAD.y + 10, PAL.cyan, 40, 460); this.burst(p.x, PAD.y + 10, PAL.text, 20, 300);
    p.w = PAD.w;
    p.x = clamp(p.x, p.w / 2, PF.w - p.w / 2);     // 줄어든 패들이 벽에 붙어 있었으면 폭 복원 후 다시 안쪽으로
  }

  crushed() {
    this.lives = 0; this.shake = 18; this.aberr = 1;
    Sfx.lose();
    this.gameOver();
  }

  gameOver() {
    this.state = 'over'; this.stateT = 0;
    this.balls = [];
    if (!this.demo) { Music.stop(); Sfx.gameOver(); }
  }

  bossDefeated() {
    this.state = 'bossdie'; this.stateT = 0;
    this.bullets = []; this.lasers = [];
    this.freeze = 0.2; this.shake = 20; this.aberr = 1;
    Music.stop();
  }

  stageClear() {
    const m = this.diff.score;
    const life = Math.round(this.lives * 500 * m);
    const time = Math.round(Math.max(0, 3000 - Math.floor(this.stageTime) * 25) * m);
    const combo = Math.round(Math.min(this.stageMaxCombo, 50) * 100 * m);
    const perfect = this.missed ? 0 : Math.round(3000 * m);
    this.bonus = { life, time, combo, perfect, total: life + time + combo + perfect };
    this.addScore(this.bonus.total);
    this.state = 'clear'; this.stateT = 0;
    this.balls = []; this.caps = []; this.lasers = []; this.bullets = []; this.booms = [];
    this.clearEff();
    if (this.demo) return;
    Music.stop(); Sfx.clear();
    this.ach('first');
    if (!this.missed) this.ach('flawless');
    if (this.mode === 'arcade' && this.stage % 5 === 4) {
      if (this.stage === 4) this.ach('boss1');
      if (this.stage === 14) this.ach('half');
      const w = Math.min(6, Math.floor(this.stage / 5) + 2);
      if (w > Storage.data.maxWorld) { Storage.data.maxWorld = w; Storage.save(); }
    }
  }

  nextStage() {
    if (this.demo) { this.done = 'over'; return; }
    if (this.stage + 1 >= this.stageCount) {
      if (this.mode === 'arcade') { this.ach('champ'); if (this.diffKey === 'hard') this.ach('iron'); }
      if (this.mode === 'daily') this.ach('daily');
      this.done = 'win';
      return;
    }
    this.stage++;
    this.loadStage();
  }
}
