import React, { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { Content, HostCmd, Scene } from '../../../shared/types';
import { connect, fetchContent, qs, secondsLeft } from '../lib/net';
import { tr, num } from '../lib/i18n';
import { useNow } from '../ui/bits';

const PIN_KEY = 'sq-pin';

export default function Host() {
  const key = qs('k');
  const [pin, setPin] = useState(sessionStorage.getItem(PIN_KEY) || '');
  const [authed, setAuthed] = useState(false);
  const [err, setErr] = useState('');
  const [c, setC] = useState<Content | null>(null);
  const [v, setV] = useState<any>(null);
  const [online, setOnline] = useState(false);
  const [tab, setTab] = useState<'run' | 'room' | 'stats'>(qs('tab') === 'stats' ? 'stats' : 'run');
  const sock = useRef<Socket | null>(null);

  useEffect(() => { fetchContent(true, key).then(setC).catch(() => setErr('Bad host link')); }, [key]);
  const login = (p: string) => {
    sock.current?.close();
    const s = connect({ role: 'host', key, pin: p });
    sock.current = s;
    s.on('connect', () => setOnline(true));
    s.on('disconnect', () => setOnline(false));
    s.on('auth-error', () => { setErr('Wrong PIN'); setAuthed(false); sessionStorage.removeItem(PIN_KEY); s.close(); });
    s.on('host', (x: any) => { setV(x); setAuthed(true); setErr(''); sessionStorage.setItem(PIN_KEY, p); });
    s.on('content', () => fetchContent(true, key).then(setC));
  };
  useEffect(() => { if (pin) login(pin); return () => { sock.current?.close(); }; }, []);
  const cmd = (x: HostCmd) => { navigator.vibrate?.(15); sock.current?.emit('cmd', x); };

  if (!authed) return (
    <div className="host login">
      <h1>🔐 Chief Auditor</h1>
      <form onSubmit={e => { e.preventDefault(); login(pin); }}>
        <input type="password" inputMode="numeric" autoFocus value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN" />
        <button className="btn-primary">Enter</button>
      </form>
      {err && <p className="err">{err}</p>}
    </div>);
  if (!c || !v) return <div className="host center"><div className="spinner" /></div>;
  const sc = c.scenes[v.scene.idx] as Scene;

  return (
    <div className="host">
      <header className="h-head">
        <span className={`dot-online ${online ? 'on' : ''}`} />
        <b>{v.scene.idx + 1}/{v.scene.total}</b> <span className="h-scene">{sceneLabel(sc, c)}</span>
        <span className={`phase ph-${v.phase}`}>{v.phase}{sc.type === 'classify' && v.phase === 'reveal' ? ` · ${v.revealItem + 1}/${sc.items!.length} ${v.revealSub || ''}` : ''}{['story', 'finale', 'inventory'].includes(sc.type) ? ` · ${v.step + 1}` : ''}</span>
      </header>
      <nav className="h-tabs">{(['run', 'room', 'stats'] as const).map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t === 'run' ? '🎬 Run' : t === 'room' ? `👥 Room (${v.counts.joined}) ${v.asks?.length ? `❓${v.asks.length}` : ''}` : '📈 Stats'}</button>)}</nav>
      {tab === 'run' && <RunTab v={v} c={c} sc={sc} cmd={cmd} />}
      {tab === 'room' && <RoomTab v={v} c={c} cmd={cmd} hostKey={key} />}
      {tab === 'stats' && <StatsTab hostKey={key} pin={sessionStorage.getItem(PIN_KEY) || ''} />}
    </div>);
}

function sceneLabel(sc: Scene, c: Content) {
  return sc.title?.en || sc.q?.en?.slice(0, 40) || ({ lobby: 'Lobby', story: 'Story', inventory: 'Inventory', finale: 'Finale' } as any)[sc.type] || sc.id;
}

function primaryAction(sc: Scene, v: any): { label: string; cmd: HostCmd; cls?: string } {
  const next: HostCmd = { type: 'next' };
  switch (sc.type) {
    case 'lobby': return { label: '▶ Start the show', cmd: next };
    case 'story': return { label: v.step < (sc.lines!.length - 1) ? '▶ Next line' : '▶ Next scene', cmd: next };
    case 'inventory': return { label: v.step < 1 ? '▶ Compare with prediction' : '▶ Next scene', cmd: next };
    case 'finale': return { label: ['▶ Top individuals', '▶ Inventory report', '▶ Takeaways', '🎉 The end'][v.step], cmd: next };
  }
  if (v.phase === 'intro') return { label: '⏱ Start timer', cmd: { type: 'start' } };
  if (v.phase === 'answering') return { label: '🔒 Lock answers', cmd: { type: 'close' } };
  if (sc.type === 'classify') {
    if (v.phase === 'closed') return { label: '📊 Show split (item 1)', cmd: next };
    if (v.revealSub === 'split' || v.revealSub === 'debate') return { label: '✔ CONFIRM', cmd: { type: 'confirm' }, cls: 'stamp-btn' };
    return { label: v.revealItem < sc.items!.length - 1 ? `📊 Show split (item ${v.revealItem + 2})` : '▶ Next scene', cmd: next };
  }
  if (sc.type === 'board') {
    if (v.phase === 'closed') return { label: '📋 Show team plans', cmd: next };
    if (v.phase === 'reveal') return v.step < 2 ? { label: v.step === 0 ? '📉 Animate footprints' : '💡 Honest moments', cmd: next } : { label: '✔ CONFIRM results', cmd: { type: 'confirm' }, cls: 'stamp-btn' };
    return { label: '▶ Next scene', cmd: next };
  }
  if (sc.type === 'wordcloud') return v.phase === 'closed' ? { label: '☁️ Show cloud', cmd: next } : { label: '▶ Next scene', cmd: next };
  if (v.phase === 'closed') return { label: '📊 Show split', cmd: next };
  if (v.phase === 'reveal') return sc.type === 'vote' && sc.poll ? { label: '▶ Next scene', cmd: next } : { label: '✔ CONFIRM', cmd: { type: 'confirm' }, cls: 'stamp-btn' };
  return { label: '▶ Next scene', cmd: next };
}

function RunTab({ v, c, sc, cmd }: any) {
  useNow(500);
  const pa = primaryAction(sc, v);
  const s = secondsLeft(v.timer);
  const isQ = ['vote', 'classify', 'calc', 'methods', 'board', 'wordcloud'].includes(sc.type);
  const contested = v.focus?.contested && v.phase === 'reveal' && v.revealSub === 'split';
  return (
    <div className="run">
      {isQ && <div className="h-status">
        <div className="h-timer">{s == null ? '—' : `${s}s`}{v.timer.endsAt ? '' : s != null ? ' ⏸' : ''}</div>
        <div className="h-count"><b>{v.counts.answered}</b>/{v.counts.total} answered</div>
      </div>}
      <button className={`h-primary ${pa.cls || ''}`} onClick={() => cmd(pa.cmd)}>{pa.label}</button>
      {contested && <button className="h-debate pulse-b" onClick={() => cmd({ type: 'debate' })}>🎤 Debate moment suggested: room split!</button>}
      <div className="h-grid">
        <button onClick={() => cmd({ type: 'back' })}>◀ Back</button>
        {isQ && <button onClick={() => cmd(v.timer.endsAt ? { type: 'pause' } : { type: 'start' })}>{v.timer.endsAt ? '⏸ Pause' : '⏱ Start'}</button>}
        {isQ && <button onClick={() => cmd({ type: 'addTime', s: 15 })}>+15 s</button>}
        {isQ && <button onClick={() => cmd({ type: 'close' })}>🔒 Lock</button>}
        {sc.type === 'classify' && <button onClick={() => cmd({ type: 'debate' })}>🎤 Debate</button>}
        {isQ && <button className="stamp-mini" onClick={() => cmd({ type: 'confirm' })}>✔ Confirm</button>}
        <button onClick={() => cmd({ type: 'skip' })}>⏭ Skip</button>
        <button className={v.overlay === 'leaderboard' ? 'on' : ''} onClick={() => cmd({ type: 'overlay', v: 'leaderboard' })}>🏆 Board</button>
        <button className={v.overlay === 'blackout' ? 'on' : ''} onClick={() => cmd({ type: 'overlay', v: 'blackout' })}>⬛ Blackout</button>
        <button className={v.overlay === 'qr' ? 'on' : ''} onClick={() => cmd({ type: 'overlay', v: 'qr' })}>📱 QR</button>
      </div>
      {v.debate && v.debate.sides?.length > 0 && <div className="h-card debate-names">🎤 {v.debate.sides.map((x: any) => `${x.name} (${x.choice})`).join('  vs  ')} <button onClick={() => cmd({ type: 'debate' })}>🔄 re-pick</button></div>}
      <Wisdom v={v} c={c} sc={sc} />
      <NameCalling v={v} sc={sc} c={c} />
      <div className="h-toggles">
        <label><input type="checkbox" checked={v.settings.autoAdvance} onChange={e => cmd({ type: 'setting', key: 'autoAdvance', v: e.target.checked })} /> Auto-advance</label>
        <label><input type="checkbox" checked={v.settings.screenOnly} onChange={e => cmd({ type: 'setting', key: 'screenOnly', v: e.target.checked })} /> Screen-only (show of hands)</label>
        <label><input type="checkbox" checked={v.settings.muted} onChange={e => cmd({ type: 'setting', key: 'muted', v: e.target.checked })} /> Mute screen</label>
        <span className="lang-sw">Screen: <button className={v.settings.lang === 'en' ? 'on' : ''} onClick={() => cmd({ type: 'lang', v: 'en' })}>EN</button><button className={v.settings.lang === 'ar' ? 'on' : ''} onClick={() => cmd({ type: 'lang', v: 'ar' })}>عربي</button></span>
      </div>
      {v.pinnedAsk && <div className="h-card">📌 Pinned: <b>{v.pinnedAsk.name}</b>: {v.pinnedAsk.text} <button onClick={() => cmd({ type: 'unpinAsk' })}>Unpin</button></div>}
      <details className="h-scenes"><summary>🗂 Jump to scene</summary>
        {c.scenes.map((x: Scene, i: number) => <button key={x.id} className={i === v.scene.idx ? 'on' : ''} onClick={() => cmd({ type: 'goto', idx: i })}>{i + 1}. {sceneLabel(x, c)} {v.confirmed?.[x.id]?.length ? '✔' : ''}</button>)}
      </details>
    </div>);
}

function Wisdom({ v, c, sc }: any) {
  let w: any = sc.wisdom; let head = '';
  if (sc.type === 'classify') { const it = c.items.find((i: any) => i.id === sc.items[Math.min(v.revealItem, sc.items.length - 1)]); w = it.wisdom; head = `${it.icon} ${it.name.en} → ${sc.mode === 'iso' ? 'ISO ' + [...it.iso, ...(it.isoAlso || [])].join('/') : it.scope + (it.cat ? ' Cat ' + it.cat : '')}`; if (sc.mode === 'iso' && sc.wisdom) w = { ...w, talk: `${it.isoReason.en} ${w.talk}` }; }
  if (sc.type === 'calc') { const k = c.calcs[sc.calc]; w = k.wisdom; head = `Answer: ${num(k.answer, 2)} t · ${k.formula.en}`; }
  if (sc.type === 'methods') { w = c.methods.wisdom; head = Object.entries(c.methods.options).map(([k, o]: any) => `${k} ${num(o.answer, 1)} t`).join(' · '); }
  if (sc.type === 'vote' && sc.correct) head = `Answer: ${sc.options.find((o: any) => o.id === sc.correct).t.en}`;
  if (sc.type === 'story') head = `"${sc.lines[v.step]?.en}"`;
  if (!w && !head) return null;
  const st = v.focus?.stat;
  return (
    <div className="h-card wisdom">
      <div className="w-head">🦉 {head}</div>
      {w?.talk && <p className="w-talk">{w.talk}</p>}
      {w?.misconception && <p className="w-mis">⚠️ {w.misconception}</p>}
      {w?.clause && <p className="w-cl">📚 {w.clause}</p>}
      {st && st.pct > 0 && <p className="w-stat">📊 <b>{st.pct}%</b> chose <b>{st.choice}</b>. {st.follow}</p>}
      {sc.type === 'calc' || sc.type === 'methods' ? v.bands && <p className="w-stat">📊 {v.bands.bands.ok} within 5% · {v.bands.bands.close} close · {v.bands.bands.slip} kg-slip · {v.bands.bands.off} off</p> : null}
    </div>);
}

function NameCalling({ v, sc, c }: any) {
  const names = v.focus?.names; if (!names || !Object.keys(names).length) return null;
  const lab = (k: string) => sc.type === 'vote' ? (sc.options.find((o: any) => o.id === k)?.t.en || k) : sc.mode === 'iso' ? `ISO ${k}` : k;
  return (
    <details className="h-card names" open={v.phase === 'reveal'}>
      <summary>🙋 Who picked what (call on people)</summary>
      {Object.entries(names).map(([k, ns]: any) => <div key={k} className="nc-row"><b>{lab(k)} ({ns.length})</b>: {ns.filter((n: string) => !n.startsWith('🤖')).slice(0, 30).join(', ') || ns.slice(0, 12).join(', ')}</div>)}
    </details>);
}

function RoomTab({ v, c, cmd, hostKey }: any) {
  const [n, setN] = useState(30);
  const pin = sessionStorage.getItem(PIN_KEY) || '';
  const screenUrl = `/screen?k=${encodeURIComponent(hostKey)}`;
  return (
    <div className="room">
      <div className="h-card">
        <h3>❓ Ask the Auditor ({v.asks.length})</h3>
        {v.asks.length === 0 && <p className="muted">No questions yet.</p>}
        {v.asks.slice().reverse().map((a: any) => <div key={a.id} className="ask-row"><span><b>{a.name}</b>: {a.text}</span><span><button onClick={() => cmd({ type: 'pinAsk', id: a.id })}>📌 Pin</button><button onClick={() => cmd({ type: 'dismissAsk', id: a.id })}>✕</button></span></div>)}
      </div>
      <div className="h-card">
        <h3>🔗 Links</h3>
        <a className="btn-link" href={screenUrl} target="_blank">🖥️ Open projector screen</a>
        <a className="btn-link" href={`/admin?k=${encodeURIComponent(hostKey)}`} target="_blank">✏️ Edit content (/admin)</a>
        <a className="btn-link" href={`/api/export.csv?k=${encodeURIComponent(hostKey)}&pin=${encodeURIComponent(pin)}`}>⬇️ Export results CSV</a>
      </div>
      <div className="h-card">
        <h3>🤖 Rehearsal bots</h3>
        <div className="row"><input type="number" min={1} max={300} value={n} onChange={e => setN(Number(e.target.value))} /><button onClick={() => cmd({ type: 'addBots', n })}>Add bots</button><button onClick={() => cmd({ type: 'removeBots' })}>Remove bots</button></div>
      </div>
      <div className="h-card">
        <h3>👥 Players ({v.players.length})</h3>
        <div className="teams-mini">{v.leaderboard.teams.map((t: any) => { const tm = c.teams.find((x: any) => x.id === t.id); return <span key={t.id}>{tm.emoji} {t.members} · {t.score}</span>; })}</div>
        <div className="plist">{v.players.map((p: any) => <div key={p.id} className="prow"><span className={`dot-online ${p.connected ? 'on' : ''}`} /><span className="pn">{p.name}</span><span>{c.teams.find((x: any) => x.id === p.teamId)?.emoji}</span><span>{p.score}</span><button onClick={() => { if (confirm(`Remove ${p.name}?`)) cmd({ type: 'removePlayer', pid: p.id }); }}>✕</button></div>)}</div>
      </div>
      <div className="h-card danger">
        <button onClick={() => { if (confirm('Reset the whole game? All players and scores will be wiped.')) cmd({ type: 'reset' }); }}>♻️ Reset game</button>
      </div>
    </div>);
}

function StatsTab({ hostKey, pin }: { hostKey: string; pin: string }) {
  const [d, setD] = useState<any>(null);
  const load = () => fetch(`/api/stats?k=${encodeURIComponent(hostKey)}&pin=${encodeURIComponent(pin)}`).then(r => r.json()).then(setD);
  useEffect(() => { load(); }, []);
  if (!d) return <div className="spinner" />;
  return (
    <div className="stats">
      <div className="row"><h3>Hardest questions first · {d.players} players</h3><button onClick={load}>↻</button><a className="btn-link" href={`/api/export.csv?k=${encodeURIComponent(hostKey)}&pin=${encodeURIComponent(pin)}`}>⬇️ CSV</a></div>
      <table className="stats-t"><thead><tr><th>Question</th><th>% correct</th><th>n</th><th>Most common wrong</th></tr></thead>
        <tbody>{d.rows.map((r: any) => <tr key={r.scene + r.item}><td>{r.label}</td><td><div className="sbar"><div style={{ width: `${r.correctPct}%` }} /><span>{r.correctPct}%</span></div></td><td>{r.n}</td><td>{r.topWrong || ''}</td></tr>)}</tbody></table>
    </div>);
}
