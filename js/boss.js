// 보스 6종. 하나의 클래스가 정의표의 기믹 플래그를 읽어 동작한다.

import { PF, PAL, BALL_R, COLS } from './config.js';
import { Sfx } from './audio.js';

export const BOSSES = [
  { name: 'GUARDIAN', hp: 18, color: PAL.blue, speed: 110, fire: 2.3,
    pat: ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X'] },
  { name: 'SHIELDER', hp: 24, color: PAL.green, speed: 120, fire: 2.1, shields: 2,
    pat: ['...XXXXX...', '.XXXXXXXXX.', 'XXXXXXXXXXX', 'XXX..X..XXX', 'XXXXXXXXXXX', '..XXX.XXX..', '.XX.....XX.'] },
  { name: 'TRICKSTER', hp: 26, color: PAL.orange, speed: 150, fire: 2.0, decoys: 2,
    pat: ['X.........X', 'XX.......XX', 'XXXXXXXXXXX', 'XX..XXX..XX', 'XXXXXXXXXXX', '.XXXX.XXXX.', '..XX...XX..'] },
  { name: 'MASON', hp: 28, color: PAL.purple, speed: 110, fire: 2.1, wall: true,
    pat: ['XXXXXXXXXXX', 'X.XXXXXXX.X', 'XXXXXXXXXXX', 'XXX.XXX.XXX', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XX.XX.XX.XX'] },
  { name: 'DEVOURER', hp: 32, color: PAL.red, speed: 130, fire: 1.8, absorb: true,
    pat: ['.XXXXXXXXX.', 'XXXXXXXXXXX', 'XX..XXX..XX', 'XXXXXXXXXXX', 'XXX.....XXX', 'XX.......XX', '.XX.....XX.'] },
  { name: 'OVERLORD', hp: 44, color: PAL.text, speed: 150, fire: 1.6, shields: 3, wall: true, spread: true,
    pat: ['X..X.X.X..X', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XX..XXX..XX', 'XXXXXXXXXXX', '.XXXXXXXXX.', '..XXX.XXX..'] },
];

export const ORB_R = 20, ORB_DIST = 165;
const BASE_Y = 162, WALL_ROW = 7;

export class Boss {
  constructor(idx, g) {
    this.idx = idx; this.def = BOSSES[idx];
    this.w = 220; this.h = 140;
    this.x = PF.w / 2; this.y = -120;
    this.hp = this.maxHp = Math.round(this.def.hp * (g.diffKey === 'easy' ? 0.8 : 1));
    this.alive = true; this.t = 0; this.dir = 1; this.flash = 0;
    this.fireT = 2.5; this.summonT = 7; this.wallT = 3; this.orbA = 0;
    this.decoys = [];
    for (let i = 0; i < (this.def.decoys || 0); i++) this.decoys.push({ x: PF.w / 2, alive: true, resp: 0, ph: 2.1 + i * 2.3 });
  }

  get phase2() { return this.hp <= this.maxHp / 2; }
  get mouthOpen() { return !!this.def.absorb && this.t % 5.5 > 3; }

  // 등장 연출과 좌우 이동 (공이 붙어 있는 동안에도 움직인다)
  move(dt) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt * 5;
    const ty = BASE_Y + Math.sin(this.t * 2) * 14;
    this.y += (ty - this.y) * Math.min(1, dt * 4);
    const sp = this.def.speed * (this.phase2 ? 1.5 : 1);
    this.x += this.dir * sp * dt;
    const m = this.w / 2 + 16;
    if (this.x < m) { this.x = m; this.dir = 1; }
    if (this.x > PF.w - m) { this.x = PF.w - m; this.dir = -1; }
    this.orbA += dt * (this.phase2 ? 2.5 : 1.6);
    const range = PF.w / 2 - m;
    for (const d of this.decoys) {
      d.x = PF.w / 2 + Math.sin(this.t * 0.9 + d.ph) * range;
      if (!d.alive) { d.resp -= dt; if (d.resp <= 0) d.alive = true; }
    }
  }

  // 공격 (공이 날아다니는 동안에만)
  attack(dt, g) {
    const def = this.def, p2 = this.phase2;
    this.fireT -= dt;
    if (this.fireT <= 0) {
      this.fireT = def.fire * (p2 ? 0.65 : 1);
      const vy = p2 ? 380 : 300, by = this.y + this.h / 2;
      const vxs = def.spread ? [-130, 0, 130] : p2 ? [-70, 70] : [0];
      for (const vx of vxs) g.bullets.push({ x: this.x, y: by, vx, vy });
      Sfx.bossShot();
    }
    this.summonT -= dt;
    if (this.summonT <= 0) {
      this.summonT = p2 ? 7 : 10;
      let live = 0;
      for (const b of g.bricks) if (b.alive && b.type !== 's') live++;
      for (let i = 0; i < 4 && live < 16; i++) {
        const row = 9 + Math.floor(g.rng() * 3), col = Math.floor(g.rng() * COLS);
        if (g.cellFree(row, col)) { g.addBrick(String(1 + Math.floor(g.rng() * 7)), row, col); live++; }
      }
    }
    if (def.wall) {
      this.wallT -= dt;
      if (this.wallT <= 0) {
        this.wallT = p2 ? 7 : 10;
        for (let c = 0; c < COLS; c++) if (g.cellFree(WALL_ROW, c)) g.addBrick('H', WALL_ROW, c);
      }
    }
  }

  orbPos(i) {
    const a = this.orbA + (i / this.def.shields) * Math.PI * 2;
    return [this.x + Math.cos(a) * ORB_DIST, this.y + Math.sin(a) * ORB_DIST * 0.62];
  }

  // 공 충돌. 처리했으면 true
  collide(b, g) {
    for (let i = 0; i < (this.def.shields || 0); i++) {
      const [ox, oy] = this.orbPos(i);
      const dx = b.x - ox, dy = b.y - oy, d = Math.hypot(dx, dy), rr = ORB_R + BALL_R;
      if (d < rr && d > 0) {
        const nx = dx / d, ny = dy / d, dot = b.vx * nx + b.vy * ny;
        if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
        b.x = ox + nx * rr; b.y = oy + ny * rr;
        Sfx.steel(); g.burst(b.x, b.y, PAL.green, 4);
        return true;
      }
    }
    for (const d of this.decoys) {
      if (d.alive && Math.abs(d.x - this.x) > 40 && g.bounce(b, d.x - this.w / 2, this.y - this.h / 2, this.w, this.h)) {
        d.alive = false; d.resp = 6;
        g.burst(d.x, this.y, this.def.color, 26); Sfx.hard();
        g.say(d.x, this.y, 'DECOY!', PAL.dim);
        return true;
      }
    }
    const n = g.bounce(b, this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
    if (!n) return false;
    const below = n === 4;   // 아랫면에 맞음
    if (below && this.mouthOpen && Math.abs(b.x - this.x) < 62) {
      b.held = 0.9; Sfx.capBad();
      this.hit(1, g, b.x, b.y);
      return true;
    }
    const crit = below && Math.abs(b.x - this.x) < 30;
    if (crit) g.say(b.x, b.y + 20, 'CRITICAL!', PAL.yellow);
    this.hit((crit ? 2 : 1) + (g.eff.F > 0 ? 1 : 0), g, b.x, b.y);
    return true;
  }

  hit(dmg, g, x, y) {
    if (!this.alive) return;
    this.hp -= dmg; this.flash = 1;
    Sfx.bossHit();
    g.addScore(50 * dmg);
    g.burst(x, y, this.def.color, 10);
    g.shake = Math.max(g.shake, 4);
    if (g.rng() < 0.14) g.dropCap(this.x, this.y + this.h / 2);
    if (this.hp <= 0) { this.hp = 0; this.alive = false; g.bossDefeated(); }
  }
}
