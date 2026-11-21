// Pure game engine: state transitions, scoring, views. No I/O.
import type { Content, GameState, HostCmd, Scene, Player, AnswerRec, ResultRec, Item } from './types';

export const TOL = 0.05;       // ±5% accepted
export const CLOSE_TOL = 0.15; // "close" band

export function newState(roomCode: string, now: number): GameState {
  return {
    v: 1, sessionId: Math.random().toString(36).slice(2, 10), roomCode, createdAt: now, updatedAt: now, rev: 1,
    sceneIdx: 0, phase: 'show', step: 0, revealItem: 0, revealSub: null,
    timer: { duration: 0, endsAt: null, remaining: null, startedAt: null },
    players: {}, answers: {}, results: {}, confirmedItems: {}, debate: null,
    asks: [], pinnedAsk: null, teamBonus: {}, boardPlans: {},
    settings: { autoAdvance: false, screenOnly: false, muted: false, lang: 'en', teamCount: 4 },
    overlay: null, orderSeq: 0, lastCmdAt: now,
  };
}

export const sceneOf = (s: GameState, c: Content): Scene => c.scenes[Math.min(s.sceneIdx, c.scenes.length - 1)];
export const itemById = (c: Content, id: string): Item => c.items.find(i => i.id === id)!;
export const isAnswerScene = (sc: Scene) => ['vote', 'classify', 'calc', 'methods', 'board', 'wordcloud'].includes(sc.type);
export const activePlayers = (s: GameState) => Object.values(s.players).filter(p => !p.removed);

// ---------- scene entry ----------
function enterScene(s: GameState, c: Content, idx: number, now: number, restore = false) {
  s.sceneIdx = Math.max(0, Math.min(idx, c.scenes.length - 1));
  const sc = sceneOf(s, c);
  s.step = 0; s.revealItem = 0; s.revealSub = null; s.debate = null;
  s.timer = { duration: sc.time || 0, endsAt: null, remaining: sc.time || null, startedAt: null };
  if (isAnswerScene(sc)) {
    const done = s.confirmedItems[sc.id];
    if (restore && done && done.length) {
      s.phase = 'confirmed';
      if (sc.type === 'classify') { s.revealItem = (sc.items!.length - 1); s.revealSub = 'confirmed'; s.phase = sc.drag && done.length >= sc.items!.length ? 'confirmed' : 'reveal'; }
    } else if (restore && s.answers[sc.id] && Object.keys(s.answers[sc.id]).length) {
      s.phase = 'closed';
    } else s.phase = 'intro';
  } else s.phase = 'show';
  if (sc.type === 'board' && s.phase === 'intro') s.boardPlans = s.boardPlans || {};
}

export function startTimer(s: GameState, sc: Scene, now: number) {
  const rem = s.timer.remaining ?? sc.time ?? 60;
  s.timer.endsAt = now + rem * 1000; s.timer.remaining = null;
  if (!s.timer.startedAt) s.timer.startedAt = now;
  s.phase = 'answering';
}

export function closeAnswers(s: GameState, c: Content, now: number) {
  const sc = sceneOf(s, c);
  if (s.timer.endsAt) s.timer.remaining = Math.max(0, Math.round((s.timer.endsAt - now) / 1000));
  s.timer.endsAt = null;
  s.phase = 'closed';
  if (sc.type === 'board') s.boardPlans = computeTeamPlans(s, c);
}

// ---------- host commands ----------
export function hostCommand(s: GameState, c: Content, cmd: HostCmd, now: number): { botsWanted?: number; removeBots?: boolean } {
  const sc = sceneOf(s, c);
  s.lastCmdAt = now;
  const out: { botsWanted?: number; removeBots?: boolean } = {};
  switch (cmd.type) {
    case 'next': next(s, c, now); break;
    case 'back': back(s, c, now); break;
    case 'goto': enterScene(s, c, cmd.idx, now, true); break;
    case 'skip': enterScene(s, c, s.sceneIdx + 1, now, true); break;
    case 'start':
      if (isAnswerScene(sc) && (s.phase === 'intro' || s.phase === 'closed' || s.phase === 'answering')) {
        if (s.phase === 'answering' && s.timer.endsAt) break;
        if (s.timer.remaining === 0) s.timer.remaining = 15;
        startTimer(s, sc, now);
      }
      break;
    case 'pause':
      if (s.timer.endsAt) { s.timer.remaining = Math.max(0, (s.timer.endsAt - now) / 1000); s.timer.endsAt = null; }
      break;
    case 'addTime': {
      const add = cmd.s || 15;
      if (s.timer.endsAt) s.timer.endsAt += add * 1000;
      else if (s.phase === 'closed' && isAnswerScene(sc)) { s.timer.remaining = add; startTimer(s, sc, now); }
      else s.timer.remaining = (s.timer.remaining || 0) + add;
      break;
    }
    case 'close': if (s.phase === 'answering' || s.phase === 'intro') closeAnswers(s, c, now); break;
    case 'split':
      if (sc.type === 'classify' && (s.phase === 'closed' || s.phase === 'reveal')) { s.phase = 'reveal'; if (s.revealSub !== 'confirmed') s.revealSub = 'split'; s.debate = null; }
      else if (s.phase === 'closed') s.phase = 'reveal';
      break;
    case 'debate': startDebate(s, c, now); break;
    case 'confirm': confirm(s, c, now); break;
    case 'confirmAll': confirmAll(s, c, now); break;
    case 'overlay': s.overlay = s.overlay === cmd.v ? null : cmd.v; break;
    case 'setting': (s.settings as any)[cmd.key] = cmd.v; break;
    case 'lang': s.settings.lang = cmd.v; break;
    case 'pinAsk': s.pinnedAsk = s.asks.find(a => a.id === cmd.id) || null; if (s.pinnedAsk) s.asks = s.asks.filter(a => a.id !== cmd.id); break;
    case 'unpinAsk': s.pinnedAsk = null; break;
    case 'dismissAsk': s.asks = s.asks.filter(a => a.id !== cmd.id); break;
    case 'removePlayer': if (s.players[cmd.pid]) { s.players[cmd.pid].removed = true; s.players[cmd.pid].connected = false; } break;
    case 'addBots': out.botsWanted = Math.max(0, Math.min(300, cmd.n)); break;
    case 'removeBots': out.removeBots = true; for (const p of Object.values(s.players)) if (p.bot) delete s.players[p.id]; break;
    case 'reset': {
      const fresh = newState(s.roomCode, now);
      fresh.settings = { ...s.settings };
      Object.assign(s, fresh); break;
    }
  }
  touch(s, now);
  return out;
}

export function touch(s: GameState, now: number) { s.rev++; s.updatedAt = now; }

function next(s: GameState, c: Content, now: number) {
  const sc = sceneOf(s, c);
  const last = s.sceneIdx >= c.scenes.length - 1;
  const go = () => { if (!last) enterScene(s, c, s.sceneIdx + 1, now, true); };
  switch (sc.type) {
    case 'lobby': go(); return;
    case 'story': if (s.step < (sc.lines?.length || 1) - 1) s.step++; else go(); return;
    case 'inventory': if (s.step < 1) s.step++; else go(); return;
    case 'finale': if (s.step < finaleSteps(sc).length - 1) s.step++; return;
  }
  // answer scenes
  if (s.phase === 'intro') { startTimer(s, sc, now); return; }
  if (s.phase === 'answering') { closeAnswers(s, c, now); return; }
  if (sc.type === 'classify') {
    if (s.phase === 'closed') { s.phase = 'reveal'; s.revealItem = 0; s.revealSub = 'split'; return; }
    if (s.phase === 'reveal') {
      if (s.revealSub === 'split' || s.revealSub === 'debate') { confirm(s, c, now); return; }
      if (s.revealSub === 'confirmed') {
        if (s.revealItem < sc.items!.length - 1) { s.revealItem++; s.revealSub = 'split'; s.debate = null; }
        else if (sc.drag) { s.phase = 'confirmed'; s.debate = null; } // results summary
        else go();
      }
      return;
    }
    if (s.phase === 'confirmed') { go(); return; }
  }
  if (sc.type === 'board') {
    if (s.phase === 'closed') { s.phase = 'reveal'; s.step = 0; return; }
    if (s.phase === 'reveal') { if (s.step < 2) s.step++; else confirm(s, c, now); return; }
    if (s.phase === 'confirmed') go();
    return;
  }
  if (sc.type === 'wordcloud') {
    if (s.phase === 'closed') { s.phase = 'reveal'; return; }
    go(); return;
  }
  // vote / calc / methods
  if (s.phase === 'closed') { s.phase = 'reveal'; return; }
  if (s.phase === 'reveal') {
    if (sc.type === 'vote' && sc.poll) { s.confirmedItems[sc.id] = ['*']; go(); return; }
    confirm(s, c, now); return;
  }
  if (s.phase === 'confirmed') go();
}

function back(s: GameState, c: Content, now: number) {
  const sc = sceneOf(s, c);
  if ((sc.type === 'story' || sc.type === 'finale' || sc.type === 'inventory') && s.step > 0) { s.step--; return; }
  if (sc.type === 'classify' && s.phase === 'confirmed') { s.phase = 'reveal'; s.revealItem = sc.items!.length - 1; s.revealSub = 'confirmed'; return; }
  if (sc.type === 'classify' && s.phase === 'reveal' && s.revealItem > 0) { s.revealItem--; s.revealSub = 'confirmed'; return; }
  if (s.sceneIdx > 0) {
    enterScene(s, c, s.sceneIdx - 1, now, true);
    const p = sceneOf(s, c);
    if (p.type === 'story') s.step = (p.lines?.length || 1) - 1;
  }
}

// ---------- players ----------
const TEAM_THRESHOLDS = [0, 0, 0, 0, 4, 40, 80]; // team n becomes active once players >= value
export function activeTeams(s: GameState, c: Content) {
  const n = activePlayers(s).length;
  let k = 4;
  if (n >= 40) k = 5;
  if (n >= 80) k = 6;
  // never drop a team that already has members
  const used = new Set(activePlayers(s).map(p => p.teamId));
  return c.teams.filter((t, i) => i < k || used.has(t.id));
}
void TEAM_THRESHOLDS;

export function addPlayer(s: GameState, c: Content, name: string, now: number, opts: { bot?: boolean; id?: string; token?: string } = {}): Player {
  const teams = activeTeams(s, c);
  const counts: Record<string, number> = {};
  for (const t of teams) counts[t.id] = 0;
  for (const p of activePlayers(s)) if (counts[p.teamId] !== undefined) counts[p.teamId]++;
  const teamId = teams.slice().sort((a, b) => counts[a.id] - counts[b.id])[0].id;
  const id = opts.id || 'p' + Math.random().toString(36).slice(2, 9);
  const token = opts.token || Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  const p: Player = { id, token, name: uniqueName(s, name), teamId, joinedAt: now, order: s.orderSeq++, connected: true, bot: !!opts.bot };
  s.players[id] = p;
  touch(s, now);
  return p;
}

export function uniqueName(s: GameState, name: string) {
  const taken = new Set(Object.values(s.players).filter(p => !p.removed).map(p => p.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let i = 2; i < 999; i++) { const n = `${name.slice(0, 14)}${i}`; if (!taken.has(n.toLowerCase())) return n; }
  return name + Math.floor(Math.random() * 1e4);
}

export const methodOf = (p: Player) => (['fuel', 'distance', 'spend'] as const)[p.order % 3];

// Player answers. Returns error string or null.
export function submitAnswer(s: GameState, c: Content, pid: string, payload: any, now: number): string | null {
  const p = s.players[pid]; if (!p || p.removed) return 'not-joined';
  const sc = sceneOf(s, c);
  if (payload?.scene !== sc.id) return 'wrong-scene';
  if (s.phase !== 'answering') return 'closed';
  const bucket = (s.answers[sc.id] ||= {});
  const prev = bucket[pid];
  const rec: AnswerRec = prev ? { ...prev } : { at: now };
  if (sc.type === 'classify') {
    const id = String(payload.item); if (!sc.items!.includes(id)) return 'bad-item';
    if (!binIds(sc).includes(String(payload.c))) return 'bad-choice';
    rec.items = { ...(rec.items || {}) };
    const cat = payload.cat && c.categories.ghgp[payload.cat] ? String(payload.cat) : (rec.items[id]?.cat);
    rec.items[id] = { c: String(payload.c), cat: payload.c === 'S3' && sc.mode === 'scope' ? cat : undefined, at: now };
  } else if (sc.type === 'vote') {
    if (!sc.options!.some(o => o.id === payload.c)) return 'bad-choice';
    rec.c = payload.c; rec.at = now;
  } else if (sc.type === 'calc' || sc.type === 'methods') {
    const v = Number(payload.v); if (!isFinite(v) || v < 0 || v > 1e9) return 'bad-number';
    rec.v = v; rec.at = now; if (sc.type === 'methods') rec.m = methodOf(p);
  } else if (sc.type === 'board') {
    const ids = (Array.isArray(payload.levers) ? payload.levers : []).map(String).filter((x: string) => c.levers.some(l => l.id === x));
    const cost = ids.reduce((a: number, id: string) => a + c.levers.find(l => l.id === id)!.cost, 0);
    if (cost > Number(c.boardModel.budget)) return 'over-budget';
    rec.levers = [...new Set(ids)] as string[]; rec.at = now;
  } else if (sc.type === 'wordcloud') {
    const w = String(payload.w || '').trim().split(/\s+/)[0]?.slice(0, 20);
    if (!w) return 'empty';
    rec.w = w; rec.at = now;
  } else return 'no-answer-here';
  bucket[pid] = rec;
  s.updatedAt = now;
  return null;
}

// ---------- splits ----------
export function itemSplit(s: GameState, sceneId: string, itemId: string) {
  const out: Record<string, number> = {}; const names: Record<string, string[]> = {}; const cats: Record<string, number> = {};
  for (const [pid, a] of Object.entries(s.answers[sceneId] || {})) {
    const x = a.items?.[itemId]; if (!x) continue;
    const p = s.players[pid]; if (!p || p.removed) continue;
    out[x.c] = (out[x.c] || 0) + 1;
    (names[x.c] ||= []).push(p.name);
    if (x.cat) cats[x.cat] = (cats[x.cat] || 0) + 1;
  }
  return { counts: out, names, cats };
}
export function voteSplit(s: GameState, sceneId: string) {
  const out: Record<string, number> = {}; const names: Record<string, string[]> = {};
  for (const [pid, a] of Object.entries(s.answers[sceneId] || {})) {
    const p = s.players[pid]; if (!p || p.removed || a.c == null) continue;
    out[a.c] = (out[a.c] || 0) + 1; (names[a.c] ||= []).push(p.name);
  }
  return { counts: out, names };
}
export function correctChoices(sc: Scene, it: Item): string[] {
  if (sc.mode === 'iso') return [...(it.iso || []), ...(it.isoAlso || [])].map(String);
  if (sc.mode === 'data') return [it.dtype!];
  return [it.scope!];
}
// Choices a player may pick in a classify scene.
export function binIds(sc: Scene): string[] {
  if (sc.bins?.length) return sc.bins.map(b => b.id);
  return sc.mode === 'iso' ? ['1', '2', '3', '4', '5', '6'] : ['S1', 'S2', 'S3'];
}
export const FINALE_STEPS = ['podium', 'top', 'report', 'takeaways'] as const;
export function finaleSteps(sc: Scene) { return sc.steps?.length ? sc.steps : [...FINALE_STEPS]; }
export function isContested(counts: Record<string, number>) {
  const tot = Object.values(counts).reduce((a, b) => a + b, 0); if (!tot) return false;
  return Math.max(...Object.values(counts)) / tot < 0.6;
}

function startDebate(s: GameState, c: Content, now: number) {
  const sc = sceneOf(s, c);
  if (sc.type !== 'classify' || s.phase !== 'reveal') return;
  const itemId = sc.items![s.revealItem];
  const { counts } = itemSplit(s, sc.id, itemId);
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2).map(x => x[0]);
  if (top.length < 2) { s.debate = { itemId, sides: [] }; s.revealSub = 'debate'; return; }
  const sides = top.map(choice => {
    const pool = Object.entries(s.answers[sc.id] || {}).filter(([pid, a]) => a.items?.[itemId]?.c === choice && s.players[pid] && !s.players[pid].removed);
    const live = pool.filter(([pid]) => s.players[pid].connected && !s.players[pid].bot);
    const pick = (live.length ? live : pool)[Math.floor(Math.random() * (live.length ? live.length : pool.length))];
    return { pid: pick[0], name: s.players[pick[0]].name, choice };
  });
  s.debate = { itemId, sides }; s.revealSub = 'debate';
  void now;
}

// ---------- scoring ----------
function speedBonus(s: GameState, at: number, max: number) {
  const st = s.timer.startedAt; const dur = (s.timer.duration || 60) * 1000;
  if (!st) return 0;
  const frac = 1 - Math.min(1, Math.max(0, (at - st) / dur));
  return Math.round(max * frac);
}

export function scoreCalc(v: number | undefined, answer: number) {
  if (v == null) return { ok: false, close: false, unitSlip: false };
  const rel = Math.abs(v - answer) / answer;
  const slip = Math.abs(v - answer * 1000) / (answer * 1000) <= TOL;
  return { ok: rel <= TOL, close: rel > TOL && rel <= CLOSE_TOL, unitSlip: slip };
}

function confirm(s: GameState, c: Content, now: number) {
  const sc = sceneOf(s, c);
  if (s.phase === 'answering' || s.phase === 'intro') closeAnswers(s, c, now);
  const ans = s.answers[sc.id] || {};
  const res = (s.results[sc.id] ||= {});
  if (sc.type === 'classify') {
    if (s.phase === 'closed') { s.phase = 'reveal'; s.revealItem = 0; }
    const itemId = sc.items![s.revealItem];
    const it = itemById(c, itemId);
    const ok = correctChoices(sc, it);
    for (const [pid, a] of Object.entries(ans)) {
      const x = a.items?.[itemId];
      const r: ResultRec = res[pid] ||= { pts: 0, items: {} };
      r.items ||= {};
      if (r.items[itemId]) continue;
      if (!x) { r.items[itemId] = { ok: false, pts: 0 }; continue; }
      const good = ok.includes(x.c);
      const half = !good && sc.mode === 'data' && !!it.dHalf?.includes(x.c);
      let pts = good ? 100 + speedBonus(s, x.at, 20) : half ? 50 : 0;
      let catOk: boolean | undefined;
      if (good && sc.mode === 'scope' && it.scope === 'S3' && x.cat) { catOk = x.cat === it.cat; if (catOk) pts += 50; }
      r.items[itemId] = { ok: good, half: half || undefined, catOk, pts };
      r.pts = Object.values(r.items).reduce((acc, z) => acc + z.pts, 0);
    }
    const ci = (s.confirmedItems[sc.id] ||= []);
    if (!ci.includes(itemId)) ci.push(itemId);
    s.revealSub = 'confirmed'; s.debate = null; s.phase = 'reveal';
    return;
  }
  if (sc.type === 'vote') {
    if (!sc.poll && sc.correct) for (const [pid, a] of Object.entries(ans)) {
      const good = a.c === sc.correct; res[pid] = { ok: good, pts: good ? (sc.points || 50) : 0 };
    }
  } else if (sc.type === 'calc') {
    const calc = c.calcs[sc.calc!];
    for (const [pid, a] of Object.entries(ans)) {
      const r = scoreCalc(a.v, calc.answer!);
      res[pid] = { ...r, pts: r.ok ? 200 + speedBonus(s, a.at, 30) : r.close ? 50 : 0 };
    }
  } else if (sc.type === 'methods') {
    for (const [pid, a] of Object.entries(ans)) {
      const opt = c.methods.options[a.m || 'fuel'];
      const r = scoreCalc(a.v, opt.answer!);
      res[pid] = { ...r, pts: r.ok ? 200 + speedBonus(s, a.at, 30) : r.close ? 50 : 0 };
    }
  } else if (sc.type === 'board') {
    if (!Object.keys(s.boardPlans).length) s.boardPlans = computeTeamPlans(s, c);
    const ranked = boardResults(s, c).filter(t => t.members > 0).sort((a, b) => b.cutLB - a.cutLB);
    const bonus = [300, 200, 100];
    s.teamBonus = {};
    ranked.forEach((t, i) => { if (i < 3 && t.cutLB > 0) s.teamBonus[t.teamId] = bonus[i]; });
  }
  s.confirmedItems[sc.id] = ['*'];
  s.phase = 'confirmed';
}

// Confirm every remaining card of a classify scene at once and jump to the results summary.
function confirmAll(s: GameState, c: Content, now: number) {
  const sc = sceneOf(s, c);
  if (sc.type !== 'classify') { confirm(s, c, now); return; }
  if (s.phase === 'answering' || s.phase === 'intro') closeAnswers(s, c, now);
  if (s.phase === 'closed') { s.phase = 'reveal'; s.revealItem = 0; s.revealSub = 'split'; }
  if (s.phase !== 'reveal') return;
  for (let i = 0; i < sc.items!.length; i++) { s.revealItem = i; s.revealSub = 'split'; confirm(s, c, now); }
  s.revealItem = sc.items!.length - 1; s.debate = null;
  s.phase = sc.drag ? 'confirmed' : 'reveal';
}

export function playerScore(s: GameState, pid: string) {
  let t = 0; for (const r of Object.values(s.results)) t += r[pid]?.pts || 0; return t;
}

export function leaderboard(s: GameState, c: Content) {
  const players = activePlayers(s).map(p => ({ id: p.id, name: p.name, teamId: p.teamId, score: playerScore(s, p.id), bot: !!p.bot }));
  players.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const teams = activeTeams(s, c).map(t => {
    const mem = players.filter(p => p.teamId === t.id);
    const avg = mem.length ? mem.reduce((a, p) => a + p.score, 0) / mem.length : 0;
    return { id: t.id, members: mem.length, avg: Math.round(avg), bonus: s.teamBonus[t.id] || 0, score: Math.round(avg) + (s.teamBonus[t.id] || 0) };
  }).filter((t, _i, all) => t.members > 0 || all.every(x => x.members === 0)).sort((a, b) => b.score - a.score);
  return { players, teams };
}

// ---------- inventory ----------
export function inventory(s: GameState, c: Content) {
  const rows: { id: string; scope: 'S1' | 'S2' | 'S3'; label: any; value: number; done: boolean; pre?: boolean }[] = [];
  for (const p of c.prefilled) rows.push({ id: p.id, scope: p.scope, label: p.label, value: p.value, done: true, pre: true });
  for (const sc of c.scenes) {
    if (sc.type === 'calc') { const k = c.calcs[sc.calc!]; rows.push({ id: sc.id, scope: k.scope, label: k.label, value: k.answer!, done: !!s.confirmedItems[sc.id] }); }
    if (sc.type === 'methods') { const o = c.methods.options[c.methods.inventoryUses]; rows.push({ id: sc.id, scope: 'S3', label: c.methods.label, value: o.answer!, done: !!s.confirmedItems[sc.id] }); }
  }
  const tot = { S1: 0, S2: 0, S3: 0 } as Record<string, number>;
  for (const r of rows) if (r.done) tot[r.scope] += r.value;
  return { rows, tot, total: tot.S1 + tot.S2 + tot.S3 };
}

// ---------- board (Chapter 4) ----------
export function computeTeamPlans(s: GameState, c: Content): Record<string, string[]> {
  const budget = Number(c.boardModel.budget);
  const plans: Record<string, string[]> = {};
  for (const t of activeTeams(s, c)) {
    const votes: Record<string, number> = {};
    for (const [pid, a] of Object.entries(s.answers['board'] || {})) {
      const p = s.players[pid]; if (!p || p.removed || p.teamId !== t.id) continue;
      for (const l of a.levers || []) votes[l] = (votes[l] || 0) + 1;
    }
    const order = Object.entries(votes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    let spent = 0; const pick: string[] = [];
    for (const [id] of order) { const cost = c.levers.find(l => l.id === id)!.cost; if (spent + cost <= budget) { pick.push(id); spent += cost; } }
    plans[t.id] = pick;
  }
  return plans;
}

export function footprint(c: Content, levers: string[]) {
  const m = c.boardModel as Record<string, number>;
  const inv = { S1: 0, S2: 0, S3: 0 } as Record<string, number>;
  const f = (id: string) => c.factors.find(x => x.id === id)!.value;
  const has = (id: string) => levers.includes(id);
  const grid = f('grid_eg'), diesel = f('diesel');
  const vans = m.dieselLitres * diesel / 1000;
  const gas = c.prefilled.find(p => p.id === 'pre_gas')!.value;
  const fridge = c.calcs.calc_fridge.answer!;
  let kwh = m.gridKWh;
  let s1 = gas + fridge * (has('leak') ? 1 - m.leakCut : 1) + (has('ev') ? 0 : vans);
  if (has('ev')) kwh += (m.dieselLitres / m.vanLPerKm) * m.evKWhPerKm;
  const gridKwh = kwh * (has('solar') ? 1 - m.solarShare : 1);
  const s2LB = gridKwh * grid / 1000;
  const s2MB = has('ppa') ? 0 : s2LB;
  const courier = c.methods.options[c.methods.inventoryUses].answer! * (has('courier_ev') ? 1 - m.courierCut : 1);
  const flour = m.flourT * (has('supplier') ? m.flourPcfEngaged : m.flourPcf);
  const s3 = flour + courier + c.calcs.calc_flights.answer!;
  inv.S1 = s1; inv.S2 = s2LB; inv.S3 = s3;
  return { S1: s1, S2LB: s2LB, S2MB: s2MB, S3: s3, LB: s1 + s2LB + s3, MB: s1 + s2MB + s3 };
}

export function boardResults(s: GameState, c: Content) {
  const base = footprint(c, []);
  const counts: Record<string, number> = {};
  for (const p of activePlayers(s)) counts[p.teamId] = (counts[p.teamId] || 0) + 1;
  return activeTeams(s, c).map(t => {
    const plan = s.boardPlans[t.id] || [];
    const fp = footprint(c, plan);
    return { teamId: t.id, plan, members: counts[t.id] || 0, fp, cutLB: base.LB - fp.LB, cutMB: base.MB - fp.MB, spent: plan.reduce((a, id) => a + c.levers.find(l => l.id === id)!.cost, 0) };
  });
}

// ---------- badges / personal card ----------
export function personalCard(s: GameState, c: Content, pid: string) {
  let classified = 0, total = 0, transportOk = 0, transportTot = 0, calcOk = 0, catOk = 0, dataOk = 0, dataTot = 0;
  const calcScenes = c.scenes.filter(sc => sc.type === 'calc' || sc.type === 'methods').length;
  for (const sc of c.scenes) {
    if (sc.type === 'classify' && sc.mode === 'data') for (const id of sc.items!) {
      if (!s.confirmedItems[sc.id]?.includes(id)) continue;
      total++; dataTot++; if (s.results[sc.id]?.[pid]?.items?.[id]?.ok) { classified++; dataOk++; }
    }
    if (sc.type === 'classify' && sc.mode === 'scope') for (const id of sc.items!) {
      if (!s.confirmedItems[sc.id]?.includes(id)) continue;
      total++; const r = s.results[sc.id]?.[pid]?.items?.[id];
      const it = itemById(c, id);
      if (it.transport) transportTot++;
      if (r?.ok) { classified++; if (it.transport) transportOk++; }
      if (r?.catOk) catOk++;
    }
    if ((sc.type === 'calc' || sc.type === 'methods') && s.results[sc.id]?.[pid]?.ok) calcOk++;
  }
  let badge = { en: 'Carbon Rookie', ar: 'مبتدئ كربون' };
  if (classified >= total * 0.5) badge = { en: 'Scope Scout', ar: 'كشّاف النطاقات' };
  if (calcOk >= 3) badge = { en: 'Calculator Ace', ar: 'بطل الحسابات' };
  if (catOk >= 5) badge = { en: 'Category Sleuth', ar: 'محقق الفئات' };
  if (transportTot && transportOk / transportTot >= 0.8) badge = { en: 'Transport Detective', ar: 'محقق النقل' };
  if (dataTot && dataOk / dataTot >= 0.8) badge = { en: 'Data Detective', ar: 'محقق البيانات' };
  if (total && classified === total && calcOk >= Math.min(4, calcScenes)) badge = { en: "Auditor's Apprentice", ar: 'تلميذ المدققة' };
  const lb = leaderboard(s, c);
  const rank = lb.players.findIndex(p => p.id === pid) + 1;
  const teamRank = lb.teams.findIndex(t => t.id === s.players[pid]?.teamId) + 1;
  return { classified, total, calcOk, catOk, badge, rank, teamRank, score: playerScore(s, pid), of: lb.players.length };
}

// ---------- word cloud ----------
export function words(s: GameState, sceneId = 'wordcloud') {
  const f: Record<string, number> = {};
  for (const [pid, a] of Object.entries(s.answers[sceneId] || {})) {
    if (!a.w || s.players[pid]?.removed) continue;
    const w = a.w.toLowerCase(); f[w] = (f[w] || 0) + 1;
  }
  return Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 60);
}

// ---------- calc histogram ----------
export function calcBands(s: GameState, c: Content, sc: Scene) {
  const bands = { ok: 0, close: 0, off: 0, slip: 0 };
  const byMethod: Record<string, number[]> = { fuel: [], distance: [], spend: [] };
  for (const [pid, a] of Object.entries(s.answers[sc.id] || {})) {
    if (s.players[pid]?.removed || a.v == null) continue;
    const target = sc.type === 'methods' ? c.methods.options[a.m || 'fuel'].answer! : c.calcs[sc.calc!].answer!;
    const r = scoreCalc(a.v, target);
    if (r.ok) bands.ok++; else if (r.unitSlip) bands.slip++; else if (r.close) bands.close++; else bands.off++;
    if (sc.type === 'methods') byMethod[a.m || 'fuel'].push(a.v);
  }
  const med = (xs: number[]) => { if (!xs.length) return null; const z = xs.slice().sort((a, b) => a - b); return z[Math.floor(z.length / 2)]; };
  return { bands, medians: { fuel: med(byMethod.fuel), distance: med(byMethod.distance), spend: med(byMethod.spend) }, n: { fuel: byMethod.fuel.length, distance: byMethod.distance.length, spend: byMethod.spend.length } };
}

// ---------- answered count ----------
export function answeredCount(s: GameState, c: Content) {
  const sc = sceneOf(s, c);
  const a = s.answers[sc.id] || {};
  let n = 0;
  for (const [pid, rec] of Object.entries(a)) {
    if (s.players[pid]?.removed) continue;
    if (sc.type === 'classify') { if (Object.keys(rec.items || {}).length >= sc.items!.length) n++; }
    else n++;
  }
  return n;
}

// Tick: auto-close on timer expiry; auto-advance if enabled.
export function tick(s: GameState, c: Content, now: number): boolean {
  if (s.phase === 'answering' && s.timer.endsAt && now >= s.timer.endsAt) {
    closeAnswers(s, c, now); s.timer.remaining = 0; touch(s, now);
    return true;
  }
  if (s.settings.autoAdvance && s.phase === 'answering') {
    const sc = sceneOf(s, c);
    const tot = activePlayers(s).filter(p => p.connected).length;
    if (tot > 0 && answeredCount(s, c) >= tot && sc.type !== 'board') { closeAnswers(s, c, now); touch(s, now); return true; }
  }
  return false;
}
