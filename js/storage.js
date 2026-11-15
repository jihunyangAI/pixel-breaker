// localStorage 저장: 설정, 랭킹, 진행도, 업적

const KEY = 'pixelbreaker.v1';
const defaults = () => ({
  settings: { music: 0.5, sfx: 0.7, fx: 2, shake: true },
  ranks: { arcade: [], endless: [], daily: [] },
  maxWorld: 1,
  ach: {},
  badCaps: 0,
  name: 'AAA',
});

export const Storage = {
  data: defaults(),
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && typeof d === 'object') {
        // 저장값은 그대로 믿지 않는다: 항목마다 형식을 확인하고, 틀리면 기본값을 쓴다
        const base = defaults(), s = d.settings || {}, out = base;
        const unit = (v, def) => (typeof v === 'number' && v >= 0 && v <= 1 ? v : def);
        out.settings.music = unit(s.music, base.settings.music);
        out.settings.sfx = unit(s.sfx, base.settings.sfx);
        out.settings.fx = [0, 1, 2].includes(s.fx) ? s.fx : base.settings.fx;
        out.settings.shake = typeof s.shake === 'boolean' ? s.shake : base.settings.shake;
        for (const m of Object.keys(base.ranks)) {
          const list = d.ranks && Array.isArray(d.ranks[m]) ? d.ranks[m] : [];
          out.ranks[m] = list
            .filter((e) => e && typeof e.name === 'string' && Number.isFinite(e.score))
            .map((e) => ({ name: e.name.slice(0, 3), score: e.score, info: typeof e.info === 'string' ? e.info.slice(0, 16) : '' }))
            .sort((a, b) => b.score - a.score).slice(0, 10);
        }
        out.maxWorld = Number.isInteger(d.maxWorld) ? Math.min(6, Math.max(1, d.maxWorld)) : 1;
        if (d.ach && typeof d.ach === 'object') for (const k in d.ach) if (d.ach[k] === true) out.ach[k] = true;
        out.badCaps = Number.isFinite(d.badCaps) && d.badCaps >= 0 ? Math.floor(d.badCaps) : 0;
        out.name = typeof d.name === 'string' && /^[A-Z0-9]{3}$/.test(d.name) ? d.name : 'AAA';
        this.data = out;
      }
    } catch { /* 저장소를 못 쓰는 환경에서는 기본값으로 동작 */ }
  },
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch { /* 무시 */ }
  },
  hi(mode) { return this.data.ranks[mode][0]?.score || 0; },
  qualifies(mode, score) {
    const r = this.data.ranks[mode];
    return score > 0 && (r.length < 10 || score > r[r.length - 1].score);
  },
  addRank(mode, entry) {
    const r = this.data.ranks[mode];
    r.push(entry);
    r.sort((a, b) => b.score - a.score);
    if (r.length > 10) r.length = 10;
    this.save();
    return r.indexOf(entry);
  },
};
