import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Content, Lang, Scene, GameState, HostCmd } from '../../../shared/types';
import { connect, fetchContent, cachedContent, qs } from '../lib/net';
import { tr, ui, num, setLang } from '../lib/i18n';
import { sfx, setMuted } from '../lib/sound';
import { CeoAvatar, Stamp, NileMap } from '../ui/art';
import { Countdown, Confetti, Bars, ScopeStack, LeaderboardPanel, TeamName, useNow } from '../ui/bits';
import { DocCard, FactorCard } from '../ui/DocCard';
import { newState, hostCommand, tick } from '../../../shared/engine';
import { screenView } from '../../../shared/views';

export default function Screen() {
  const key = qs('k');
  const [c, setC] = useState<Content | null>(cachedContent(true));
  const [v, setV] = useState<any>(null);
  const [online, setOnline] = useState(true);
  const [lostSince, setLostSince] = useState<number | null>(null);
  const [local, setLocal] = useState<GameState | null>(null);
  const [soundOk, setSoundOk] = useState(false);
  const [join, setJoin] = useState<{ url: string; short: string; room: string } | null>(null);
  const skew = useRef(0);
  const preview = qs('preview');

  useEffect(() => { fetchContent(true, key).then(setC).catch(() => { }); }, [key]);
  useEffect(() => { fetch('/api/join-url').then(r => r.json()).then(setJoin).catch(() => { }); }, [v?.roomCode]);
  useEffect(() => {
    if (preview) return;
    const s = connect({ role: 'screen', key });
    s.on('connect', () => { setOnline(true); setLostSince(null); });
    s.on('disconnect', () => { setOnline(false); setLostSince(Date.now()); });
    s.on('screen', (x: any) => { skew.current = x.now - Date.now(); setV(x); });
    s.on('content', () => fetchContent(true, key).then(setC));
    return () => { s.close(); };
  }, [key, preview]);

  // Admin preview: render a given scene with an empty state
  useEffect(() => {
    if (!preview || !c) return;
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'sq-preview') setC(e.data.content); };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [preview, c]);

  // Local (offline) screen-only mode driven by keyboard
  useEffect(() => {
    if (!local || !c) return;
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, HostCmd> = { ArrowRight: { type: 'next' }, ' ': { type: 'next' }, PageDown: { type: 'next' }, ArrowLeft: { type: 'back' }, PageUp: { type: 'back' }, s: { type: 'start' }, c: { type: 'confirm' }, p: { type: 'pause' }, l: { type: 'overlay', v: 'leaderboard' }, b: { type: 'overlay', v: 'blackout' } };
      const cmd = map[e.key]; if (!cmd) return;
      e.preventDefault();
      const st = { ...local }; hostCommand(st, c, cmd, Date.now()); setLocal(st);
    };
    const t = setInterval(() => { const st = { ...local }; if (tick(st, c, Date.now())) setLocal(st); }, 250);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); clearInterval(t); };
  }, [local, c]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'L' && e.shiftKey && !local && c) { const st = newState('----', Date.now()); st.settings.screenOnly = true; st.sceneIdx = 1; st.phase = 'show'; setLocal(st); }
      if (e.key === 'f') document.documentElement.requestFullscreen?.().catch(() => { });
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [local, c]);

  const lang: Lang = (local ? 'en' : v?.settings?.lang) || 'en';
  useEffect(() => { setLang(lang); }, [lang]);
  useEffect(() => { setMuted(!!v?.settings?.muted); }, [v?.settings?.muted]);

  if (!c) return <div className="screen center"><div className="spinner" /></div>;
  let view = v;
  if (local) view = screenView(local, c, Date.now());
  if (preview) { const st = newState('0000', Date.now()); const idx = Math.max(0, c.scenes.findIndex(s => s.id === preview)); st.sceneIdx = idx; st.phase = ['lobby', 'story', 'inventory', 'finale'].includes(c.scenes[idx].type) ? 'show' : 'intro'; view = screenView(st, c, Date.now()); }
  if (!view) return <div className="screen center"><div className="spinner" /><p>Connecting…</p></div>;

  return (
    <div className={`screen lang-${lang}`} dir={lang === 'ar' ? 'rtl' : 'ltr'} onClick={() => { if (!soundOk) { sfx.unlock(); setSoundOk(true); } }}>
      <Stage v={view} c={c} lang={lang} join={join} skew={local ? 0 : skew.current} screenOnly={!!view.settings?.screenOnly} />
      {!soundOk && !preview && <div className="sound-gate">🔊 Click anywhere to enable sound · press F for fullscreen</div>}
      {!online && !local && lostSince && <div className="lost">📡 Connection lost. Reconnecting… <b>Shift+L</b> = screen-only mode (keyboard: → next, ← back, S start, C confirm)</div>}
      {local && <div className="local-badge">✋ Screen-only mode · → next · ← back · S start · C confirm</div>}
    </div>
  );
}

function Stage({ v, c, lang, join, skew, screenOnly }: { v: any; c: Content; lang: Lang; join: any; skew: number; screenOnly: boolean }) {
  const sc = c.scenes[v.scene.idx] as Scene;
  const chapter = useMemo(() => { for (let i = v.scene.idx; i >= 0; i--) { const s = c.scenes[i]; if (s.chapter) return s; } return null; }, [v.scene.idx, c]);
  const prevConfirmed = useRef<string>('');
  const sig = JSON.stringify(v.confirmed?.[sc.id] || []) + v.phase + v.revealSub;
  useEffect(() => {
    if (prevConfirmed.current && prevConfirmed.current !== sig && (v.phase === 'confirmed' || v.revealSub === 'confirmed')) sfx.stamp();
    prevConfirmed.current = sig;
  }, [sig]);
  if (v.overlay === 'blackout') return <div className="blackout" />;
  const stamped = sc.type === 'classify' ? v.revealSub === 'confirmed' : sc.type === 'inventory' ? v.step >= 1 : sc.type === 'finale' ? v.step === 2 : (v.phase === 'confirmed' && !(sc.type === 'vote' && sc.poll));
  const showCounter = ['vote', 'classify', 'calc', 'methods', 'board', 'wordcloud'].includes(sc.type) && (v.phase === 'answering' || v.phase === 'intro' || v.phase === 'closed');
  return (
    <>
      <div className="topbar">
        <div className="tb-title">🥖 {tr(c.meta.title, lang)}{chapter?.title ? <span className="tb-ch"> · {tr(chapter.title, lang)}</span> : null}</div>
        {stamped && !showCounter && <div className="stamp-pill" aria-live="polite">✔ {lang === 'ar' ? 'اعتمدتها كبيرة المدققين' : 'Confirmed by the Chief Auditor'} — {c.meta.instructorName}</div>}
        {showCounter && !screenOnly && <div className="tb-count"><b>{v.counts.answered}</b> {ui('of', lang)} <b>{v.counts.total}</b> {ui('answered', lang)}</div>}
        <div className="tb-room">{join?.short ? <>{join.short} · </> : null}{ui('room', lang)} <b>{v.roomCode}</b> · 👥 {v.counts.joined}</div>
      </div>
      <div className="stage">
        <SceneStage sc={sc} v={v} c={c} lang={lang} join={join} skew={skew} screenOnly={screenOnly} />
        {['vote', 'classify', 'calc', 'methods', 'board', 'wordcloud'].includes(sc.type) && (v.phase === 'answering' || v.phase === 'intro') && <div className="cd-wrap"><Countdown timer={v.timer} phase={v.phase} skew={skew} sound={!v.settings?.muted} /></div>}
      </div>
      {v.overlay === 'leaderboard' && <div className="overlay"><LeaderboardPanel lb={v.leaderboard} c={c} lang={lang} /></div>}
      {v.overlay === 'qr' && join && <div className="overlay"><JoinPanel join={join} lang={lang} /></div>}
      {v.pinnedAsk && <div className="pinned-ask">❓ <b>{v.pinnedAsk.name}:</b> {v.pinnedAsk.text}</div>}
    </>
  );
}

function JoinPanel({ join, lang, compact }: { join: any; lang: Lang; compact?: boolean }) {
  return (
    <div className={`joinpanel ${compact ? 'compact' : ''}`}>
      <img className="qr" src={`/api/qr.svg?u=${encodeURIComponent(join.url)}`} alt="QR" />
      <div className="jp-text">
        <div className="jp-scan">📱 {ui('scanToJoin', lang)}</div>
        <div className="jp-or">{ui('orGoTo', lang)}</div>
        <div className="jp-url">{join.short}</div>
        <div className="jp-code">{ui('room', lang)} <b>{join.room}</b></div>
      </div>
    </div>
  );
}

function Ceo({ line, lang, c, big }: { line: any; lang: Lang; c: Content; big?: boolean }) {
  const text = tr(line, lang);
  const [n, setN] = useState(0);
  useEffect(() => { setN(0); }, [text]);
  useEffect(() => {
    if (n >= text.length) return;
    const t = setTimeout(() => { setN(x => Math.min(text.length, x + 2)); if (n % 6 === 0) sfx.blip(); }, 18);
    return () => clearTimeout(t);
  }, [n, text]);
  return (
    <div className={`ceo-row ${big ? 'big' : ''}`}>
      <CeoAvatar size={big ? 260 : 150} talking={n < text.length} />
      <div className="bubble"><div className="bubble-who">{tr(c.meta.ceoName, lang)}</div><div className="bubble-text">{text.slice(0, n)}<span className="caret">{n < text.length ? '▍' : ''}</span></div></div>
    </div>
  );
}

const AuditorStamp = ({ c, lang, show }: { c: Content; lang: Lang; show: boolean }) => <Stamp show={show} label={ui('confirmedBy', lang)} short={lang === 'ar' ? 'اعتمدتها كبيرة المدققين' : 'Confirmed by the Chief Auditor'} name={c.meta.instructorName} />;

function SceneStage({ sc, v, c, lang, join, skew, screenOnly }: any) {
  switch (sc.type) {
    case 'lobby': return <Lobby v={v} c={c} lang={lang} join={join} />;
    case 'story': return (
      <div className="story">
        {sc.title && <h1 className="chapter-title">{tr(sc.title, lang)}</h1>}
        <Ceo line={sc.lines[v.step]} lang={lang} c={c} big />
        {sc.showConsolidation && v.step === sc.lines.length - 1 && <div className="board-note">📌 {tr(c.meta.consolidation, lang)}</div>}
      </div>);
    case 'vote': return <VoteStage sc={sc} v={v} c={c} lang={lang} screenOnly={screenOnly} />;
    case 'classify': return sc.mode === 'iso' ? <IsoStage sc={sc} v={v} c={c} lang={lang} screenOnly={screenOnly} /> : <ClassifyStage sc={sc} v={v} c={c} lang={lang} screenOnly={screenOnly} />;
    case 'wordcloud': return <WordStage sc={sc} v={v} lang={lang} />;
    case 'calc': return <CalcStage sc={sc} v={v} c={c} lang={lang} screenOnly={screenOnly} />;
    case 'methods': return <MethodsStage sc={sc} v={v} c={c} lang={lang} screenOnly={screenOnly} />;
    case 'inventory': return <InventoryStage sc={sc} v={v} c={c} lang={lang} />;
    case 'board': return <BoardStage sc={sc} v={v} c={c} lang={lang} />;
    case 'finale': return <FinaleStage sc={sc} v={v} c={c} lang={lang} />;
  }
  return null;
}

// ---------------- lobby ----------------
function Lobby({ v, c, lang, join }: any) {
  const prev = useRef(0);
  const [bump, setBump] = useState(false);
  useEffect(() => { if (v.counts.joined > prev.current) { sfx.join(); setBump(true); const t = setTimeout(() => setBump(false), 300); prev.current = v.counts.joined; return () => clearTimeout(t); } prev.current = v.counts.joined; }, [v.counts.joined]);
  const names = v.lobby?.names || [];
  return (
    <div className="lobby">
      <div className="lobby-left">
        <h1 className="mega">{tr(c.meta.title, lang)}</h1>
        <p className="lobby-sub">{tr(c.meta.subtitle, lang)}</p>
        {join && <JoinPanel join={join} lang={lang} />}
      </div>
      <div className="lobby-right">
        <div className={`counter ${bump ? 'bump' : ''}`}>{v.counts.joined}<small>{ui('players', lang)}</small></div>
        <div className="bubbles">{names.slice(-60).reverse().map((n: any, i: number) => { const t = c.teams.find((x: any) => x.id === n.teamId)!; return <span key={n.id} className="nick" style={{ background: t.color, animationDelay: `${(i % 6) * 0.03}s` }}>{n.name}</span>; })}</div>
        <div className="team-strip">{v.teams.map((t: any) => { const tm = c.teams.find((x: any) => x.id === t.id)!; return <span key={t.id} className="ts" style={{ borderColor: tm.color }}>{tm.emoji} {tr(tm.name, lang)} <b>{t.members}</b></span>; })}</div>
      </div>
    </div>
  );
}

// ---------------- vote ----------------
function VoteStage({ sc, v, c, lang, screenOnly }: any) {
  const total = Object.values(v.split || {}).reduce((a: number, b: any) => a + b, 0) as number;
  const confirmed = v.phase === 'confirmed';
  const showBars = (v.phase === 'reveal' || confirmed) && !screenOnly;
  return (
    <div className="vote">
      {sc.poll && <div className="poll-tag">📊 {lang === 'ar' ? 'استطلاع سريع' : 'Pulse poll'}</div>}
      <h1 className="q-big">{tr(sc.q, lang)}</h1>
      {screenOnly && v.phase !== 'confirmed' && v.phase !== 'intro' && <div className="hands">{ui('showOfHands', lang)}</div>}
      <div className={`vote-grid n${sc.options.length}`}>
        {sc.options.map((o: any, i: number) => {
          const n = v.split?.[o.id] || 0; const pct = total ? Math.round(100 * n / total) : 0;
          const ok = confirmed && sc.correct === o.id;
          return (
            <div key={o.id} className={`vtile vt${i} ${confirmed && sc.correct ? (ok ? 'correct' : 'dimmed') : ''}`}>
              <span className="vt-letter">{'ABCD'[i]}</span><span className="vt-text">{tr(o.t, lang)}</span>
              {showBars && <div className="vt-bar" style={{ width: `${pct}%` }} />}
              {showBars && <span className="vt-pct">{pct}%</span>}
            </div>);
        })}
      </div>
      {confirmed && sc.reveal && <div className="reveal-box">{sc.reveal.map((l: any, i: number) => <p key={i} style={{ animationDelay: `${0.6 + i * 0.7}s` }}>{tr(l, lang)}</p>)}<div className="src">📚 {sc.revealSource?.split(' + ').map((k: string) => c.sources[k.trim()]).join(' · ')}</div></div>}
      <AuditorStamp c={c} lang={lang} show={confirmed && !!sc.correct} />
    </div>
  );
}

// ---------------- classify (scope) ----------------
const SCOPES = ['S1', 'S2', 'S3'];
function ClassifyStage({ sc, v, c, lang, screenOnly }: any) {
  const items = sc.items.map((id: string) => c.items.find((i: any) => i.id === id));
  const done: Record<string, string> = {};
  for (const id of v.confirmed?.[sc.id] || []) done[id] = c.items.find((i: any) => i.id === id).scope;
  if (v.phase === 'intro' || v.phase === 'answering' || v.phase === 'closed') {
    return (
      <div className="classify-board">
        <div className="map-wrap"><NileMap items={c.items} lit={sc.items} done={done} lang={lang} /></div>
        <div className="side">
          <h2 className="side-title">{tr(sc.title, lang)}</h2>
          {sc.ceo && <Ceo line={sc.ceo} lang={lang} c={c} />}
          <div className="side-items">{items.map((it: any, i: number) => <div key={it.id} className="side-item"><span className="si-n">{i + 1}</span><span className="si-ico">{it.icon}</span><span>{tr(it.name, lang)}</span></div>)}</div>
          <div className="bins-legend">{SCOPES.map(s => <span key={s} className={`bin-chip ${s.toLowerCase()}`}>{lang === 'ar' ? `نطاق ${s[1]}` : `Scope ${s[1]}`}</span>)}</div>
          {v.phase === 'closed' && <div className="locked-big">🔒 {lang === 'ar' ? 'الإجابات اتقفلت!' : 'Answers locked!'}</div>}
        </div>
      </div>);
  }
  const it = items[v.revealItem];
  const sp = v.splits?.[it.id] || { counts: {}, cats: {} };
  const total = Object.values(sp.counts).reduce((a: number, b: any) => a + b, 0) as number;
  const confirmed = v.revealSub === 'confirmed';
  const top = Math.max(0, ...Object.values(sp.counts) as number[]);
  const contested = total > 0 && top / total < 0.6;
  return (
    <div className="reveal-item">
      <div className="ri-left">
        <div className="ri-progress">{v.revealItem + 1} / {items.length}</div>
        <div className="ri-icon">{it.icon}</div>
        <h1 className="ri-name">{tr(it.name, lang)}</h1>
        <p className="ri-desc">{tr(it.desc, lang)}</p>
        {contested && !confirmed && !screenOnly && <div className="contested">🔥 {lang === 'ar' ? 'القاعة منقسمة!' : 'The room is split!'}</div>}
      </div>
      <div className="ri-right">
        {screenOnly && !confirmed ? <div className="hands big">{ui('showOfHands', lang)}<div className="hands-opts">{SCOPES.map(s => <span key={s} className={`bin-chip ${s.toLowerCase()}`}>{lang === 'ar' ? `نطاق ${s[1]}` : `Scope ${s[1]}`}</span>)}</div></div>
          : <Bars total={total} correct={confirmed ? [it.scope] : undefined} rows={SCOPES.map(s => ({ id: s, label: lang === 'ar' ? `نطاق ${s[1]}` : `Scope ${s[1]}`, cls: s.toLowerCase(), n: sp.counts[s] || 0 }))} />}
        {confirmed && <div className="answer-box">
          <div className="ab-head"><span className={`bin-chip ${it.scope.toLowerCase()}`}>{lang === 'ar' ? `نطاق ${it.scope[1]}` : `Scope ${it.scope[1]}`}</span>{it.cat && <span className="cat-chip">{lang === 'ar' ? 'فئة' : 'Cat'} {tr(c.categories.ghgp[it.cat], lang)}</span>}</div>
          <p className="ab-why">{tr(it.reason, lang)}</p>
          <div className="src">📚 {c.sources[it.source]}</div>
        </div>}
      </div>
      {v.debate && v.revealSub === 'debate' && <DebateCard d={v.debate} lang={lang} iso={false} c={c} />}
      <AuditorStamp c={c} lang={lang} show={confirmed} />
    </div>
  );
}

function DebateCard({ d, lang, iso, c }: any) {
  useEffect(() => { sfx.whoosh(); }, []);
  const lab = (x: string) => iso ? tr(c.categories.iso[x], lang) : (lang === 'ar' ? `نطاق ${x[1]}` : `Scope ${x[1]}`);
  return (
    <div className="debate">
      <div className="debate-title">🎤 {ui('debate', lang)}</div>
      <div className="debate-vs">
        {d.sides.length ? d.sides.map((s: any, i: number) => <React.Fragment key={s.pid}>{i === 1 && <div className="vs">VS</div>}<div className={`side-card ${iso ? 'iso' + s.choice : s.choice.toLowerCase()}`}><div className="sc-name">{s.name}</div><div className="sc-choice">{lab(s.choice)}</div><div className="sc-sub">{ui('defend', lang)}</div></div></React.Fragment>)
          : <div className="side-card">{lang === 'ar' ? 'مين عايز يدافع؟' : 'Who wants to defend their answer?'}</div>}
      </div>
    </div>);
}

// ---------------- classify (ISO) → mapping table ----------------
function IsoStage({ sc, v, c, lang, screenOnly }: any) {
  const items = sc.items.map((id: string) => c.items.find((i: any) => i.id === id));
  const confirmedIds: string[] = v.confirmed?.[sc.id] || [];
  if (v.phase === 'intro' || v.phase === 'answering' || v.phase === 'closed') {
    return (
      <div className="iso-board">
        <h1 className="q-big">{tr(sc.title, lang)}</h1>
        <div className="iso-cats">{Object.entries(c.categories.iso).map(([k, x]: any) => <div key={k} className={`iso-cat iso${k}`}><b>{k}</b><span>{tr(x, lang).replace(/^\d\s/, '')}</span></div>)}</div>
        <div className="iso-items">{items.map((it: any) => <span key={it.id} className="iso-item">{it.icon} {tr(it.name, lang)}</span>)}</div>
        <div className="src">📚 {c.sources['ISO_524']}</div>
        {v.phase === 'closed' && <div className="locked-big">🔒 {lang === 'ar' ? 'الإجابات اتقفلت!' : 'Answers locked!'}</div>}
      </div>);
  }
  const cur = items[v.revealItem];
  const sp = v.splits?.[cur.id] || { counts: {} };
  const total = Object.values(sp.counts).reduce((a: number, b: any) => a + b, 0) as number;
  const allDone = confirmedIds.length === items.length;
  const label = (it: any) => `${it.scope}${it.cat ? ' · Cat ' + it.cat : ''}`;
  return (
    <div className="iso-reveal">
      <table className="maptable">
        <thead><tr><th>{lang === 'ar' ? 'المصدر' : 'Source'}</th><th>GHG Protocol</th><th>ISO 14064-1</th></tr></thead>
        <tbody>{items.map((it: any) => {
          const shown = confirmedIds.includes(it.id); const isCur = it.id === cur.id;
          return (
            <tr key={it.id} className={`${shown ? 'shown' : ''} ${isCur ? 'cur' : ''}`}>
              <td>{it.icon} {tr(it.name, lang)}</td>
              <td>{shown ? <span className={`bin-chip ${it.scope.toLowerCase()}`}>{label(it)}</span> : '…'}</td>
              <td>{shown ? <span className={`iso-chip iso${it.iso[0]}`}>{[...it.iso, ...(it.isoAlso || [])].map((x: number) => tr(c.categories.iso[x], lang)).join(' / ')}</span> : isCur && !screenOnly && total ? <MiniSplit counts={sp.counts} total={total} /> : '…'}</td>
            </tr>);
        })}</tbody>
      </table>
      {v.revealSub === 'confirmed' && !allDone && <div className="iso-why">{cur.icon} {tr(cur.isoReason, lang)} <span className="src">📚 {c.sources[cur.isoSource]}</span></div>}
      {allDone && <div className="insight">💡 {tr(sc.insight, lang)}</div>}
      {v.debate && v.revealSub === 'debate' && <DebateCard d={v.debate} lang={lang} iso c={c} />}
      <AuditorStamp c={c} lang={lang} show={v.revealSub === 'confirmed'} />
    </div>);
}
function MiniSplit({ counts, total }: any) {
  return <span className="minisplit">{Object.entries(counts).sort((a: any, b: any) => b[1] - a[1]).slice(0, 3).map(([k, n]: any) => <span key={k} className={`iso${k}`}>ISO {k}: {Math.round(100 * n / total)}%</span>)}</span>;
}

// ---------------- word cloud ----------------
function WordStage({ sc, v, lang }: any) {
  const ws: [string, number][] = v.words || [];
  const max = Math.max(1, ...ws.map(w => w[1]));
  return (
    <div className="wordcloud">
      <h1 className="q-big">{tr(sc.q, lang)}</h1>
      <div className="cloud">{ws.map(([w, n], i) => <span key={w} className={`w w${i % 6}`} style={{ fontSize: `${2 + 5 * (n / max)}rem` }}>{w}</span>)}</div>
    </div>);
}

// ---------------- calc ----------------
function CalcStage({ sc, v, c, lang, screenOnly }: any) {
  const k = c.calcs[sc.calc];
  const f = c.factors.find((x: any) => x.id === k.factor);
  const confirmed = v.phase === 'confirmed';
  const b = v.bands?.bands || { ok: 0, close: 0, off: 0, slip: 0 };
  const tot = b.ok + b.close + b.off + b.slip;
  return (
    <div className="calc-stage">
      <div className="cs-left">
        <h1 className="cs-title">{k.icon} {tr(sc.title, lang)}</h1>
        <DocCard doc={k.doc} lang={lang} big />
        {screenOnly && !confirmed && <div className="hands">🧮 {lang === 'ar' ? 'احسبوها مع اللي جنبكم!' : 'Work it out with your neighbour!'}</div>}
      </div>
      <div className="cs-right">
        {!confirmed && <FactorCard f={f} lang={lang} />}
        {(v.phase === 'intro' || v.phase === 'answering') && <div className="calc-hint">🧮 {lang === 'ar' ? 'النشاط × المعامل ÷ 1,000 = طن CO₂e' : 'Activity × factor ÷ 1,000 = t CO₂e'}</div>}
        {v.phase === 'reveal' && !screenOnly && <Bars total={tot} correct={confirmed ? ['ok'] : undefined} rows={[
          { id: 'ok', label: lang === 'ar' ? 'في حدود ±5%' : 'Within ±5%', cls: 'good', n: b.ok },
          { id: 'close', label: lang === 'ar' ? 'قريب (±15%)' : 'Close (±15%)', cls: 'mid', n: b.close },
          { id: 'slip', label: lang === 'ar' ? 'كيلو بدل طن' : 'kg, not tonnes', cls: 'slip', n: b.slip },
          { id: 'off', label: lang === 'ar' ? 'بعيد' : 'Off', cls: 'bad', n: b.off }]} />}
        {confirmed && <div className="answer-box big"><div className="ab-num" dir="ltr">{num(k.answer, 1)} <small>t CO₂e</small></div><p className="ab-formula" dir="ltr">{tr(k.formula, 'en')}</p><div className="src">📚 {f.source}</div></div>}
        {confirmed && <ScopeStack inv={v.inventory} lang={lang} highlight={sc.id} vh={34} />}
        {v.phase === 'closed' && <div className="locked-big">🔒 {lang === 'ar' ? 'الإجابات اتقفلت!' : 'Answers locked!'}</div>}
      </div>
      <AuditorStamp c={c} lang={lang} show={confirmed} />
    </div>);
}

// ---------------- methods ----------------
function MethodsStage({ sc, v, c, lang, screenOnly }: any) {
  const m = c.methods; const confirmed = v.phase === 'confirmed';
  const keys = ['fuel', 'distance', 'spend'];
  const max = Math.max(...keys.map(k => m.options[k].answer));
  return (
    <div className="methods-stage">
      <h1 className="cs-title">🚚 {tr(sc.title, lang)}</h1>
      {(v.phase === 'intro' || v.phase === 'answering' || v.phase === 'closed') && <div className="ms-pre">
        {sc.ceo && <Ceo line={sc.ceo} lang={lang} c={c} />}
        <DocCard doc={m.doc} lang={lang} big />
        {v.phase === 'closed' && <div className="locked-big">🔒 {lang === 'ar' ? 'الإجابات اتقفلت!' : 'Answers locked!'}</div>}
      </div>}
      {(v.phase === 'reveal' || confirmed) && <div className="ms-cols">
        {keys.map(k => {
          const o = m.options[k]; const med = v.bands?.medians?.[k]; const n = v.bands?.n?.[k] || 0;
          return (
            <div key={k} className={`ms-col m-${k}`}>
              <div className="ms-name">{tr(o.name, lang)}</div>
              {confirmed ? <div className="ms-barwrap"><div className="ms-bar" style={{ height: `${100 * o.answer / max}%` }}><span>{num(o.answer, 1) + ' t'}</span></div></div>
                : <div className="ms-big" dir="ltr">{screenOnly || med == null ? '?' : num(med, 1)}<small>{lang === 'ar' ? 'وسيط القاعة (طن)' : 'room median (t)'}</small></div>}
              {!screenOnly && confirmed && <div className="ms-room">{lang === 'ar' ? 'وسيط القاعة' : 'Room median'}: <b dir="ltr">{med == null ? '—' : num(med, 1)}</b> <small>(n={n})</small></div>}
              {confirmed && <div className="ms-f" dir="ltr">{tr(o.formula, 'en')}</div>}
            </div>);
        })}
      </div>}
      {confirmed && <div className="hierarchy">{lang === 'ar' ? 'جودة البيانات' : 'Data quality'}: <b>⛽ {tr(m.options.fuel.name, lang)}</b> ▶ <b>📏 {tr(m.options.distance.name, lang)}</b> ▶ <b>💵 {tr(m.options.spend.name, lang)}</b></div>}
      <AuditorStamp c={c} lang={lang} show={confirmed} />
    </div>);
}

// ---------------- inventory ----------------
function InventoryStage({ sc, v, c, lang }: any) {
  const inv = v.inventory;
  const pred = v.prediction || {};
  const pt = Object.values(pred).reduce((a: number, b: any) => a + b, 0) as number;
  return (
    <div className="inventory">
      <div className="inv-left">
        <h1 className="cs-title">📊 {tr(sc.title, lang)}</h1>
        <div className="inv-total" dir="ltr">{num(inv.total, 0)} <small>t CO₂e</small></div>
        <ul className="inv-rows">{inv.rows.filter((r: any) => r.done).map((r: any) => <li key={r.id} className={r.scope.toLowerCase()}><span>{tr(r.label, lang)}</span><b dir="ltr">{num(r.value, 1)}</b></li>)}</ul>
        <p className="muted small">{ui('notMeasured', lang)}</p>
      </div>
      <div className="inv-right">
        <ScopeStack inv={inv} lang={lang} vh={v.step >= 1 ? 34 : 52} />
        {v.step >= 1 && <div className="prediction">
          <h3>{ui('prediction', lang)}</h3>
          <Bars total={pt} correct={['S3']} rows={['S1', 'S2', 'S3'].map(s => ({ id: s, label: lang === 'ar' ? `نطاق ${s[1]}` : `Scope ${s[1]}`, cls: s.toLowerCase(), n: pred[s] || 0 }))} />
        </div>}
      </div>
      <AuditorStamp c={c} lang={lang} show={v.step >= 1} />
    </div>);
}

// ---------------- board ----------------
function BoardStage({ sc, v, c, lang }: any) {
  const b = v.board; const base = b?.base;
  if (v.phase === 'intro' || v.phase === 'answering' || v.phase === 'closed') return (
    <div className="board-pre">
      <h1 className="cs-title">🏛️ {tr(sc.title, lang)}</h1>
      <div className="lever-grid">{c.levers.map((l: any) => <div key={l.id} className="lever-tile"><span className="lt-ico">{l.icon}</span><b>{tr(l.name, lang)}</b><small>{tr(l.effect, lang)}</small><span className="lt-cost">🪙 {l.cost}</span></div>)}</div>
      <div className="muted big-note">{lang === 'ar' ? `الميزانية: ${c.boardModel.budget} عملة لكل فريق` : `Budget: ${c.boardModel.budget} coins per team`} · 🗳️ {b?.votes || 0}</div>
      {v.phase === 'closed' && <div className="locked-big">🔒 {lang === 'ar' ? 'الخطط اتقفلت!' : 'Plans locked!'}</div>}
    </div>);
  const res = (b?.results || []).filter((r: any) => r.members > 0);
  const maxLB = base?.LB || 1;
  return (
    <div className="board-reveal">
      <h1 className="cs-title">🏛️ {tr(sc.title, lang)}</h1>
      {v.step === 0 && v.phase !== 'confirmed' && <div className="plans">{res.map((r: any) => <div key={r.teamId} className="plan"><TeamName c={c} id={r.teamId} lang={lang} /><div className="plan-levers">{r.plan.length ? r.plan.map((id: string) => { const l = c.levers.find((x: any) => x.id === id); return <span key={id} className="pl">{l.icon} {tr(l.name, lang)}</span>; }) : '—'}</div></div>)}</div>}
      {(v.step === 1 || v.phase === 'confirmed') && <div className="fp-chart">
        <div className="fp-legend"><span className="s1">S1</span><span className="s2">S2</span><span className="s3">S3</span> · {ui('locationBased', lang)} / <i>{ui('marketBased', lang)}</i></div>
        <FpRow label={ui('before', lang)} fp={base} max={maxLB} lang={lang} />
        {res.sort((a: any, b: any) => b.cutLB - a.cutLB).map((r: any, i: number) => <FpRow key={r.teamId} label={<><span className="rank">{i + 1}</span><TeamName c={c} id={r.teamId} lang={lang} /></>} fp={r.fp} max={maxLB} lang={lang} cutLB={r.cutLB} cutMB={r.cutMB} />)}
      </div>}
      {v.step >= 2 && v.phase !== 'confirmed' && <div className="honest">{sc.honest.map((h: any, i: number) => <p key={i} style={{ animationDelay: `${i * 0.6}s` }}>{tr(h, lang)}</p>)}</div>}
      <AuditorStamp c={c} lang={lang} show={v.phase === 'confirmed'} />
    </div>);
}
function FpRow({ label, fp, max, lang, cutLB, cutMB }: any) {
  if (!fp) return null;
  const w = (x: number) => `${(100 * x / max) * 0.92}%`;
  return (
    <div className="fp-row">
      <div className="fp-label">{label}</div>
      <div className="fp-bars">
        <div className="fp-bar"><div className="s1" style={{ width: w(fp.S1) }} /><div className="s2" style={{ width: w(fp.S2LB) }} /><div className="s3" style={{ width: w(fp.S3) }} /><span className="fp-v" dir="ltr">{num(fp.LB, 0)} t</span></div>
        <div className="fp-bar mb"><div className="s1" style={{ width: w(fp.S1) }} /><div className="s2" style={{ width: w(fp.S2MB) }} /><div className="s3" style={{ width: w(fp.S3) }} /><span className="fp-v" dir="ltr">{num(fp.MB, 0)} t</span></div>
      </div>
      {cutLB != null && <div className="fp-cut" dir="ltr">−{num(cutLB, 0)} t <small>(MB −{num(cutMB, 0)})</small></div>}
    </div>);
}

// ---------------- finale ----------------
function FinaleStage({ sc, v, c, lang }: any) {
  const lb = v.leaderboard; const inv = v.inventory;
  useEffect(() => { if (v.step === 0) sfx.fanfare(); }, [v.step]);
  if (v.step === 0) {
    const t = lb?.teams || [];
    const order = [t[1], t[0], t[2]];
    return (
      <div className="podium-wrap">
        <Confetti />
        <h1 className="mega">🏆 {lang === 'ar' ? 'الفرق الفائزة' : 'Champions'}</h1>
        <div className="podium">{order.map((x: any, i: number) => x ? <div key={x.id} className={`pod p${[2, 1, 3][i]}`}><div className="pod-team"><TeamName c={c} id={x.id} lang={lang} /></div><div className="pod-score">{x.score}</div><div className="pod-block">{[2, 1, 3][i]}</div></div> : <div key={i} className="pod empty" />)}</div>
      </div>);
  }
  if (v.step === 1) return (
    <div className="top-ind">
      <h1 className="mega">⭐ {ui('topPlayers', lang)}</h1>
      <div className="ind">{(lb?.top || []).slice(0, 3).map((p: any, i: number) => <div key={i} className={`ind-card i${i}`}><div className="ind-medal">{['🥇', '🥈', '🥉'][i]}</div><div className="ind-name">{p.name}</div><TeamName c={c} id={p.teamId} lang={lang} /><div className="ind-score">{p.score}</div></div>)}</div>
    </div>);
  if (v.step === 2) return (
    <div className="report">
      <div className="report-paper">
        <div className="rp-head"><div><div className="rp-co">🥖 {tr(c.meta.company, lang)}</div><h1>{lang === 'ar' ? `جرد الكربون ${c.meta.inventoryYear}` : `Carbon Inventory ${c.meta.inventoryYear}`}</h1></div><div className="rp-total" dir="ltr">{num(inv.total, 0)}<small> t CO₂e</small></div></div>
        <div className="rp-body">
          <table className="rp-table"><tbody>
            {['S1', 'S2', 'S3'].map(s => <React.Fragment key={s}>
              <tr className={`rp-scope ${s.toLowerCase()}`}><td>{lang === 'ar' ? `النطاق ${s[1]}` : `Scope ${s[1]}`}{s === 'S2' ? ` (${ui('locationBased', lang)})` : ''}</td><td dir="ltr">{num(inv.tot[s], 1)} t</td><td dir="ltr">{inv.total ? Math.round(100 * inv.tot[s] / inv.total) : 0}%</td></tr>
              {inv.rows.filter((r: any) => r.scope === s && r.done).map((r: any) => <tr key={r.id} className="rp-row"><td>{tr(r.label, lang)}</td><td dir="ltr">{num(r.value, 1)}</td><td /></tr>)}
            </React.Fragment>)}
          </tbody></table>
          <div className="rp-side">
            <ScopeStack inv={inv} lang={lang} vh={27} />
            <p className="rp-note">{lang === 'ar' ? 'منهجية: بروتوكول GHG (سيطرة مالية)، GWP من AR6، معاملات DESNZ/EEHC/IPCC. معتمد من كبيرة المدققين.' : 'Method: GHG Protocol, financial control; GWP100 AR6; factors DESNZ / EEHC / IPCC. Approved by the Chief Auditor.'}</p>
            <p className="rp-note">{ui('notMeasured', lang)}</p>
          </div>
        </div>
      </div>
      <AuditorStamp c={c} lang={lang} show />
    </div>);
  return (
    <div className="takeaways">
      <h1 className="mega">{ui('takeaways', lang)}</h1>
      <ol>{sc.takeaways.map((t: any, i: number) => <li key={i} style={{ animationDelay: `${i * 0.5}s` }}>{tr(t, lang)}</li>)}</ol>
      <div className="thanks">— {c.meta.instructorName}, {lang === 'ar' ? 'كبيرة المدققين' : 'Chief Auditor'}</div>
    </div>);
}
