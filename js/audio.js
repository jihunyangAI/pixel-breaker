// Web Audio 칩튠: 효과음 합성 + 스텝 시퀀서. 음원 파일 없음.

let ac = null, master, musicG, sfxG, noiseBuf, timer = null;
const st = { music: 0.5, sfx: 0.7, muted: false };
const last = {};   // 효과음 종류별 최근 재생 시각 (동시 다발 방지)

function applyVol() {
  if (!ac) return;
  master.gain.value = st.muted ? 0 : 1;
  musicG.gain.value = st.music * 0.9;
  sfxG.gain.value = st.sfx;
}

function tone(type, f0, f1, dur, vol, delay = 0, dest = sfxG) {
  if (!ac) return;
  const t = ac.currentTime + delay;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.03);
}

function noise(dur, vol, freq, delay = 0, dest = sfxG, type = 'lowpass') {
  if (!ac) return;
  const t = ac.currentTime + delay;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = noiseBuf; s.loop = true;
  f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
}

function gate(name, ms) {
  if (!ac || !Sfx.on) return false;
  const now = performance.now();
  if (last[name] && now - last[name] < ms) return false;
  last[name] = now;
  return true;
}

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];
const seq = (notes, type, dur, vol, gap) => notes.forEach((f, i) => tone(type, f, f, dur, vol, i * gap));

export const Sfx = {
  on: true,
  brick(combo) {
    if (!gate('brick', 22)) return;
    const f = 392 * Math.pow(2, SCALE[Math.min(Math.max(combo, 1) - 1, SCALE.length - 1)] / 12);
    tone('square', f, f, 0.09, 0.11); tone('triangle', f * 2, f * 2, 0.06, 0.08);
  },
  hard() { if (gate('hard', 25)) tone('square', 300, 240, 0.07, 0.1); },
  steel() { if (gate('steel', 30)) { tone('square', 1500, 1500, 0.05, 0.06); tone('square', 2250, 2250, 0.09, 0.04); } },
  paddle() { if (gate('paddle', 30)) tone('triangle', 240, 170, 0.09, 0.3); },
  wall() { if (gate('wall', 30)) tone('square', 170, 150, 0.04, 0.05); },
  launch() { if (gate('launch', 50)) tone('square', 300, 620, 0.1, 0.09); },
  bomb() { if (gate('bomb', 40)) { noise(0.45, 0.5, 900); tone('sine', 130, 38, 0.4, 0.5); } },
  laser() { if (gate('laser', 40)) tone('square', 1500, 320, 0.09, 0.06); },
  capGood() { if (gate('cap', 60)) seq([523, 659, 784, 1047], 'square', 0.09, 0.09, 0.055); },
  capBad() { if (gate('cap', 60)) { tone('sawtooth', 420, 120, 0.32, 0.12); tone('square', 210, 60, 0.32, 0.07); } },
  oneUp() { if (gate('1up', 100)) seq([784, 988, 1175, 1568, 1976], 'square', 0.12, 0.1, 0.08); },
  barrier() { if (gate('barrier', 50)) { tone('triangle', 500, 1000, 0.15, 0.25); noise(0.12, 0.12, 4000, 0, sfxG, 'highpass'); } },
  lose() { if (gate('lose', 200)) { tone('square', 440, 70, 0.7, 0.14); noise(0.5, 0.25, 1200, 0.05); } },
  stun() { if (gate('stun', 80)) { tone('sawtooth', 160, 90, 0.2, 0.14); noise(0.15, 0.15, 2000); } },
  bossShot() { if (gate('bshot', 60)) tone('sawtooth', 520, 200, 0.14, 0.07); },
  bossHit() { if (gate('bhit', 40)) { tone('square', 180, 90, 0.12, 0.16); noise(0.1, 0.2, 1800); } },
  bossDie() { if (gate('bdie', 90)) { noise(0.5, 0.45, 700); tone('sine', 110, 30, 0.5, 0.45); } },
  warn() { if (gate('warn', 200)) seq([330, 262, 330, 262], 'square', 0.16, 0.09, 0.2); },
  clear() { if (gate('clear', 500)) seq([523, 659, 784, 659, 784, 1047, 784, 1047, 1319], 'square', 0.14, 0.1, 0.11); },
  gameOver() { if (gate('over', 500)) seq([392, 370, 330, 294, 262, 196], 'triangle', 0.4, 0.3, 0.26); },
  move() { if (gate('move', 30)) tone('square', 660, 660, 0.04, 0.06); },
  select() { if (gate('select', 50)) { tone('square', 880, 880, 0.06, 0.08); tone('square', 1320, 1320, 0.09, 0.08, 0.06); } },
  ach() { if (gate('ach', 300)) seq([659, 784, 1047, 1319, 1568], 'triangle', 0.18, 0.3, 0.09); },
  tick() { if (gate('tick', 40)) tone('square', 1000, 1000, 0.03, 0.05); },
};

// ---- 음악 ----------------------------------------------------------------
// lead: 8분음표 32개 (4마디), roots: 반 마디마다 베이스 근음 8개. 숫자는 MIDI 음, 0 은 쉼표.
const SONGS = {
  title: { bpm: 132, roots: [45, 45, 41, 41, 36, 36, 43, 43],
    lead: [69, 0, 72, 76, 0, 76, 72, 69, 65, 0, 69, 72, 0, 72, 69, 65, 64, 0, 67, 72, 0, 72, 67, 64, 62, 0, 67, 71, 74, 71, 67, 62] },
  w1: { bpm: 126, roots: [36, 36, 33, 33, 41, 41, 43, 43],
    lead: [72, 76, 79, 76, 72, 76, 79, 84, 69, 72, 76, 72, 69, 72, 76, 81, 65, 69, 72, 69, 65, 69, 72, 77, 67, 71, 74, 71, 79, 77, 74, 71] },
  w2: { bpm: 134, roots: [38, 38, 36, 36, 43, 43, 45, 45],
    lead: [74, 0, 74, 77, 76, 74, 72, 0, 72, 0, 72, 76, 74, 72, 67, 0, 71, 0, 74, 79, 77, 74, 71, 0, 72, 76, 81, 0, 79, 76, 72, 0] },
  w3: { bpm: 140, roots: [40, 40, 36, 36, 38, 38, 35, 35],
    lead: [76, 79, 83, 79, 76, 0, 74, 76, 72, 76, 79, 76, 72, 0, 71, 72, 74, 78, 81, 78, 74, 0, 72, 74, 71, 75, 78, 75, 83, 81, 78, 75] },
  w4: { bpm: 118, roots: [42, 42, 38, 38, 40, 40, 37, 37],
    lead: [73, 0, 0, 69, 73, 0, 76, 0, 74, 0, 0, 69, 74, 0, 78, 0, 76, 0, 0, 71, 76, 0, 80, 0, 77, 0, 73, 0, 68, 0, 73, 77] },
  w5: { bpm: 150, roots: [43, 43, 39, 39, 41, 41, 38, 38],
    lead: [79, 79, 0, 82, 79, 0, 77, 74, 79, 79, 0, 82, 79, 0, 75, 70, 77, 77, 0, 81, 77, 0, 72, 69, 74, 78, 81, 78, 86, 84, 81, 78] },
  w6: { bpm: 144, roots: [36, 36, 44, 44, 39, 39, 43, 43],
    lead: [84, 0, 79, 75, 72, 75, 79, 0, 84, 0, 80, 75, 72, 75, 80, 0, 82, 0, 79, 75, 70, 75, 79, 0, 83, 0, 79, 74, 71, 74, 79, 83] },
  boss: { bpm: 160, roots: [40, 40, 41, 41, 40, 40, 38, 38],
    lead: [76, 0, 76, 77, 76, 0, 74, 0, 77, 0, 77, 79, 77, 0, 76, 0, 76, 0, 76, 77, 76, 0, 83, 0, 74, 0, 74, 77, 81, 77, 74, 72] },
};
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
let cur = null, step = 0, nextT = 0;

function schedule() {
  if (!ac || !cur || ac.state !== 'running') return;
  const s = SONGS[cur], e = 30 / s.bpm;
  if (nextT < ac.currentTime) nextT = ac.currentTime + 0.05;
  while (nextT < ac.currentTime + 0.15) {
    const d = nextT - ac.currentTime, i = step % 32;
    const n = s.lead[i];
    if (n) {
      const hold = s.lead[(i + 1) % 32] === 0 ? 1.7 : 0.92;
      tone('square', mtof(n), mtof(n), e * hold, 0.05, d, musicG);
    }
    const root = s.roots[(i >> 2) % 8], b = i % 2 ? root + 12 : root;
    tone('triangle', mtof(b), mtof(b), e * 0.85, 0.2, d, musicG);
    if (i % 4 === 0) tone('sine', 150, 45, 0.12, 0.3, d, musicG);
    if (i % 4 === 2) noise(0.1, 0.12, 1800, d, musicG, 'highpass');
    noise(0.03, 0.035, 7000, d, musicG, 'highpass');
    nextT += e; step++;
  }
}

export const Music = {
  play(name) { if (cur === name) return; cur = name; step = 0; nextT = 0; },
  stop() { cur = null; },
};

export const Audio = {
  // 브라우저 정책상 첫 입력 이후에만 시작할 수 있다
  unlock() {
    if (ac) { if (ac.state === 'suspended' && !document.hidden) ac.resume(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    master = ac.createGain();
    const comp = ac.createDynamicsCompressor();
    master.connect(comp); comp.connect(ac.destination);
    musicG = ac.createGain(); sfxG = ac.createGain();
    musicG.connect(master); sfxG.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVol();
    timer = setInterval(schedule, 25);
  },
  setVol(music, sfx) { st.music = music; st.sfx = sfx; applyVol(); },
  toggleMute() { st.muted = !st.muted; applyVol(); return st.muted; },
  get muted() { return st.muted; },
  suspend() { if (ac && ac.state === 'running') ac.suspend(); },
  resume() { if (ac && ac.state === 'suspended') ac.resume(); },
};
