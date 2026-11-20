// View models sent to clients. Built from state + content.
import type { Content, GameState } from './types';
import {
  sceneOf, itemById, itemSplit, voteSplit, leaderboard, inventory, boardResults, words, calcBands,
  answeredCount, activePlayers, personalCard, methodOf, activeTeams, isContested, correctChoices, footprint, playerScore,
} from './engine';

// Strip answer keys & instructor notes from content for the audience.
export function publicContent(c: Content): Content {
  const x: Content = JSON.parse(JSON.stringify(c));
  for (const it of x.items) { delete it.scope; delete it.cat; delete it.iso; delete it.isoAlso; delete it.reason; delete it.isoReason; delete it.wisdom; delete it.source; delete it.isoSource; }
  for (const k of Object.values(x.calcs)) { delete k.answer; delete k.formula; delete k.wisdom; delete (k as any).scope; }
  for (const o of Object.values(x.methods.options)) { delete o.answer; delete o.formula; }
  delete x.methods.wisdom;
  for (const sc of x.scenes) { delete sc.correct; delete sc.reveal; delete sc.wisdom; delete sc.insight; delete sc.takeaways; delete sc.honest; }
  x.prefilled = [];
  return x;
}

function revealedKeys(s: GameState, c: Content) {
  const sc = sceneOf(s, c);
  const done = s.confirmedItems[sc.id] || [];
  const out: any = {};
  if (sc.type === 'classify') {
    out.items = {};
    for (const id of done) {
      const it = itemById(c, id);
      out.items[id] = { scope: it.scope, cat: it.cat, iso: it.iso, isoAlso: it.isoAlso, reason: it.reason, isoReason: it.isoReason, source: c.sources[it.source!], isoSource: c.sources[it.isoSource!] };
    }
  } else if (done.length) {
    if (sc.type === 'vote') out.vote = { correct: sc.correct, reveal: sc.reveal, source: sc.revealSource ? sc.revealSource.split(' + ').map(k => c.sources[k.trim()] || k).join(' · ') : undefined };
    if (sc.type === 'calc') { const k = c.calcs[sc.calc!]; out.calc = { answer: k.answer, formula: k.formula, source: c.factors.find(f => f.id === k.factor)?.source }; }
    if (sc.type === 'methods') out.methods = Object.fromEntries(Object.entries(c.methods.options).map(([k, o]) => [k, { answer: o.answer, formula: o.formula, source: c.factors.find(f => f.id === o.factor)?.source }]));
  }
  return out;
}

export function playerPublicView(s: GameState, c: Content) {
  const sc = sceneOf(s, c);
  return {
    rev: s.rev, cmdAt: s.lastCmdAt, roomCode: s.roomCode,
    scene: { id: sc.id, type: sc.type, idx: s.sceneIdx, total: c.scenes.length },
    phase: s.phase, step: s.step, revealItem: s.revealItem, revealSub: s.revealSub,
    timer: s.timer, screenOnly: s.settings.screenOnly,
    revealed: revealedKeys(s, c),
    board: sc.type === 'board' && s.phase !== 'intro' && s.phase !== 'answering' ? { plans: s.boardPlans } : undefined,
  };
}

export function playerPrivateView(s: GameState, c: Content, pid: string) {
  const p = s.players[pid]; if (!p) return null;
  const sc = sceneOf(s, c);
  const team = c.teams.find(t => t.id === p.teamId)!;
  const card = sc.type === 'finale' ? personalCard(s, c, pid) : undefined;
  return {
    pid, name: p.name, teamId: p.teamId, team: { name: team.name, emoji: team.emoji, color: team.color },
    removed: !!p.removed, score: playerScore(s, pid), method: methodOf(p),
    answer: s.answers[sc.id]?.[pid] || null,
    result: s.results[sc.id]?.[pid] || null,
    card,
  };
}

export function screenView(s: GameState, c: Content, now: number) {
  const sc = sceneOf(s, c);
  const players = activePlayers(s);
  const connected = players.filter(p => p.connected).length;
  const v: any = {
    rev: s.rev, now, cmdAt: s.lastCmdAt, roomCode: s.roomCode, sessionId: s.sessionId,
    scene: { id: sc.id, type: sc.type, idx: s.sceneIdx, total: c.scenes.length },
    phase: s.phase, step: s.step, revealItem: s.revealItem, revealSub: s.revealSub,
    timer: s.timer, settings: s.settings, overlay: s.overlay,
    counts: { answered: answeredCount(s, c), total: connected, joined: players.length },
    pinnedAsk: s.pinnedAsk, debate: s.debate,
    teams: activeTeams(s, c).map(t => ({ id: t.id, members: players.filter(p => p.teamId === t.id).length })),
    confirmed: s.confirmedItems,
  };
  if (sc.type === 'lobby') v.lobby = { names: players.slice(-80).map(p => ({ id: p.id, name: p.name, teamId: p.teamId })) };
  if (sc.type === 'classify') {
    v.splits = Object.fromEntries(sc.items!.map(id => [id, itemSplit(s, sc.id, id)]).map(([id, x]: any) => [id, { counts: x.counts, cats: x.cats }]));
  }
  if (sc.type === 'vote') v.split = voteSplit(s, sc.id).counts;
  if (sc.type === 'calc' || sc.type === 'methods') v.bands = calcBands(s, c, sc);
  if (sc.type === 'wordcloud') v.words = words(s, sc.id);
  if (sc.type === 'board') { v.board = { results: boardResults(s, c), base: footprint(c, []), plans: s.boardPlans, votes: Object.keys(s.answers.board || {}).length }; }
  if (sc.type === 'inventory' || sc.type === 'calc' || sc.type === 'methods' || sc.type === 'finale') v.inventory = inventory(s, c);
  if (sc.type === 'inventory') v.prediction = voteSplit(s, 'poll_bigscope').counts;
  if (sc.type === 'finale' || s.overlay === 'leaderboard') {
    const lb = leaderboard(s, c);
    v.leaderboard = { teams: lb.teams, top: lb.players.slice(0, 10).map(p => ({ name: p.name, teamId: p.teamId, score: p.score })) };
  }
  return v;
}

export function hostView(s: GameState, c: Content, now: number) {
  const v = screenView(s, c, now);
  const sc = sceneOf(s, c);
  const lb = leaderboard(s, c);
  v.leaderboard = { teams: lb.teams, top: lb.players.slice(0, 10).map(p => ({ name: p.name, teamId: p.teamId, score: p.score })) };
  v.asks = s.asks.slice(-50);
  v.players = Object.values(s.players).filter(p => !p.removed).map(p => ({ id: p.id, name: p.name, teamId: p.teamId, connected: p.connected, bot: !!p.bot, score: playerScore(s, p.id) }))
    .sort((a, b) => b.score - a.score).slice(0, 400);
  // names per answer + live stat for wisdom card
  if (sc.type === 'classify') {
    const id = sc.items![Math.min(s.revealItem, sc.items!.length - 1)];
    const it = itemById(c, id);
    const sp = itemSplit(s, sc.id, id);
    const tot = Object.values(sp.counts).reduce((a, b) => a + b, 0);
    const good = correctChoices(sc, it);
    const wrong = Object.entries(sp.counts).filter(([k]) => !good.includes(k)).sort((a, b) => b[1] - a[1])[0];
    v.focus = { itemId: id, names: sp.names, counts: sp.counts, contested: isContested(sp.counts), total: tot,
      stat: wrong && tot ? { pct: Math.round(100 * wrong[1] / tot), choice: wrong[0], follow: it.wisdom?.follow?.[wrong[0]] || '' } : null };
  }
  if (sc.type === 'vote') { const sp = voteSplit(s, sc.id); v.focus = { names: sp.names, counts: sp.counts }; }
  if (sc.type === 'calc' || sc.type === 'methods') {
    const names: Record<string, string[]> = { ok: [], off: [] };
    const bands = (v.bands as any);
    for (const [pid, r] of Object.entries(s.results[sc.id] || {})) { const p = s.players[pid]; if (p && !p.removed) (r.ok ? names.ok : names.off).push(p.name); }
    v.focus = { names, bands };
  }
  return v;
}

export function statsReport(s: GameState, c: Content) {
  const rows: { scene: string; item: string; label: string; correctPct: number; n: number; topWrong?: string }[] = [];
  for (const sc of c.scenes) {
    if (sc.type === 'classify') for (const id of sc.items!) {
      const it = itemById(c, id); const sp = itemSplit(s, sc.id, id);
      const n = Object.values(sp.counts).reduce((a, b) => a + b, 0); if (!n) continue;
      const good = correctChoices(sc, it);
      const ok = Object.entries(sp.counts).filter(([k]) => good.includes(k)).reduce((a, [, v]) => a + v, 0);
      const wrong = Object.entries(sp.counts).filter(([k]) => !good.includes(k)).sort((a, b) => b[1] - a[1])[0];
      rows.push({ scene: sc.id, item: id, label: `${sc.mode === 'iso' ? 'ISO' : 'Scope'}: ${it.name.en}`, correctPct: Math.round(100 * ok / n), n, topWrong: wrong ? `${wrong[0]} (${Math.round(100 * wrong[1] / n)}%)` : undefined });
    }
    if (sc.type === 'calc' || sc.type === 'methods' || (sc.type === 'vote' && !sc.poll)) {
      const ans = s.answers[sc.id] || {}; const n = Object.keys(ans).length; if (!n) continue;
      let ok = 0;
      for (const pid of Object.keys(ans)) if (s.results[sc.id]?.[pid]?.ok) ok++;
      rows.push({ scene: sc.id, item: sc.id, label: sc.title?.en || sc.q?.en || sc.id, correctPct: Math.round(100 * ok / n), n });
    }
  }
  rows.sort((a, b) => a.correctPct - b.correctPct);
  return rows;
}

export function exportCsv(s: GameState, c: Content) {
  const lb = leaderboard(s, c);
  const scored = c.scenes.filter(sc => ['classify', 'calc', 'methods', 'vote'].includes(sc.type) && !sc.poll);
  const head = ['rank', 'nickname', 'team', 'score', ...scored.map(sc => sc.id)];
  const esc = (x: any) => { const t = String(x ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const lines = [head.join(',')];
  lb.players.forEach((p, i) => {
    const team = c.teams.find(t => t.id === p.teamId)?.name.en;
    lines.push([i + 1, p.name, team, p.score, ...scored.map(sc => s.results[sc.id]?.[p.id]?.pts ?? '')].map(esc).join(','));
  });
  return lines.join('\n');
}
