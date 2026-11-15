// 상수: 좌표계, 팔레트, 난이도, 파워업, 업적

// 논리 좌표. 가로 화면은 1280x960 (HUD 오른쪽), 세로 화면은 880x1134 (HUD 위쪽).
export const V = { w: 1280, h: 960, portrait: false };
export const PF = { x: 24, y: 24, w: 832, h: 936 };   // 플레이필드 (x, y 는 레이아웃에 따라 바뀐다)
export const HUD = { x: 880, y: 24, w: 376, h: 912 };
export const PORTRAIT_TOP = 150;                       // 세로 화면 상단 HUD 높이
export const SIZES = { land: [1280, 960], port: [880, 1134] };
export function setLayout(portrait) {
  V.portrait = portrait;
  if (portrait) { V.w = SIZES.port[0]; V.h = SIZES.port[1]; PF.x = 24; PF.y = PORTRAIT_TOP + 24; }
  else { V.w = SIZES.land[0]; V.h = SIZES.land[1]; PF.x = 24; PF.y = 24; }
}
export const BW = 64, BH = 32, COLS = 13, BRICK_TOP = 88;
export const PAD = { y: 852, w: 128, h: 22 };
export const BALL_R = 8;
export const DANGER_Y = 780;                           // ENDLESS 한계선
export const STEP = 1 / 120;                           // 고정 물리 타임스텝

export const PAL = {
  bg: '#0b0b1a', dark: '#15162c', frame: '#3a3f5c', dim: '#7c82a6', text: '#f4f4f4',
  red: '#ff3b5c', orange: '#ff8a1f', yellow: '#ffd23f', green: '#3ddc84',
  blue: '#29b6f6', purple: '#7c4dff', pink: '#ff5ec4',
  steel: '#9aa0b4', warn: '#ff1744', cyan: '#7df9ff', gold: '#ffc400',
};

export const BRICK_COLORS = [PAL.red, PAL.orange, PAL.yellow, PAL.green, PAL.blue, PAL.purple, PAL.pink];
export const BRICK_SCORES = [120, 110, 100, 90, 80, 70, 60];

export const WORLDS = [
  { name: 'BLUE SECTOR', color: PAL.blue },
  { name: 'GREEN SECTOR', color: PAL.green },
  { name: 'ORANGE SECTOR', color: PAL.orange },
  { name: 'PURPLE SECTOR', color: PAL.purple },
  { name: 'RED SECTOR', color: PAL.red },
  { name: 'MONO SECTOR', color: PAL.text },
];

export const DIFFS = {
  easy: { label: 'EASY', lives: 5, speed: 0.86, score: 1, desc: '5 LIVES - SLOWER BALL' },
  normal: { label: 'NORMAL', lives: 3, speed: 1, score: 1, desc: '3 LIVES - STANDARD' },
  hard: { label: 'HARD', lives: 2, speed: 1.15, score: 1.5, desc: '2 LIVES - FAST BALL - SCORE X1.5' },
};

// 캡슐: 글자가 곧 효과 키. '$' 는 1UP (하트 글리프)
export const CAPS = {
  E: { name: 'EXPAND', color: PAL.blue, dur: 20 },
  M: { name: 'MULTI', color: PAL.cyan },
  L: { name: 'LASER', color: PAL.red, dur: 15 },
  F: { name: 'FIRE', color: PAL.orange, dur: 8 },
  C: { name: 'CATCH', color: PAL.green, dur: 20 },
  S: { name: 'SLOW', color: PAL.yellow, dur: 10 },
  B: { name: 'BARRIER', color: PAL.purple },
  $: { name: '1UP', color: PAL.pink },
  T: { name: 'TINY', color: PAL.warn, dur: 12, bad: true },
  X: { name: 'FAST', color: PAL.warn, dur: 10, bad: true },
  R: { name: 'REVERSE', color: PAL.warn, dur: 6, bad: true },
};
export const CAP_GOOD = ['E', 'M', 'L', 'F', 'C', 'S', 'B'];
export const CAP_BAD = ['T', 'X', 'R'];

export const ACHS = [
  { id: 'first', name: 'FIRST CLEAR', desc: 'CLEAR ANY STAGE' },
  { id: 'combo', name: 'COMBO MASTER', desc: 'REACH COMBO X8' },
  { id: 'flawless', name: 'FLAWLESS', desc: 'CLEAR A STAGE WITHOUT A MISS' },
  { id: 'juggler', name: 'JUGGLER', desc: 'KEEP 5 BALLS IN PLAY' },
  { id: 'chain', name: 'CHAIN REACTION', desc: 'CHAIN 5 BOMBS' },
  { id: 'dare', name: 'DAREDEVIL', desc: 'GRAB 10 BAD CAPSULES' },
  { id: 'boss1', name: 'BOSS HUNTER', desc: 'DEFEAT THE FIRST BOSS' },
  { id: 'half', name: 'HALFWAY THERE', desc: 'DEFEAT THE WORLD 3 BOSS' },
  { id: 'champ', name: 'CHAMPION', desc: 'CLEAR ALL 30 STAGES' },
  { id: 'iron', name: 'IRON WILL', desc: 'CLEAR ARCADE ON HARD' },
  { id: 'marathon', name: 'MARATHON', desc: 'SCORE 100,000 IN ENDLESS' },
  { id: 'daily', name: 'DAILY PLAYER', desc: 'FINISH A DAILY RUN' },
];
