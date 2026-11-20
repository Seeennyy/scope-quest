import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { Content, Lang, Scene } from '../../../shared/types';
import { connect, fetchContent, cachedContent, qs, secondsLeft } from '../lib/net';
import { useLang, tr, ui, num } from '../lib/i18n';
import { sfx, buzz } from '../lib/sound';
import { Calculator } from '../ui/Calculator';
import { DocCard, FactorCard } from '../ui/DocCard';

type Pub = any; type Me = any;
const TOKEN_KEY = 'sq-token';

export default function Play() {
  const [lang, setLang] = useLang();
  const [content, setContent] = useState<Content | null>(cachedContent());
  const [pub, setPub] = useState<Pub | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [needJoin, setNeedJoin] = useState(false);
  const [online, setOnline] = useState(true);
  const [askOpen, setAskOpen] = useState(false);
  const sock = useRef<Socket | null>(null);

  useEffect(() => { fetchContent().then(setContent).catch(() => { }); }, []);
  useEffect(() => {
    const s = connect({ role: 'player', token: localStorage.getItem(TOKEN_KEY) || '' });
    sock.current = s;
    s.on('connect', () => setOnline(true));
    s.on('disconnect', () => setOnline(false));
    s.on('need-join', () => { localStorage.removeItem(TOKEN_KEY); setNeedJoin(true); setMe(null); });
    s.on('pub', setPub);
    s.on('me', (m: Me) => { if (m?.removed) { localStorage.removeItem(TOKEN_KEY); } setMe(m); });
    s.on('content', () => fetchContent().then(setContent));
    s.on('reset', () => { localStorage.removeItem(TOKEN_KEY); location.reload(); });
    // ensure the token is re-sent on every reconnect
    s.io.on('reconnect_attempt', () => { (s as any).auth = { role: 'player', token: localStorage.getItem(TOKEN_KEY) || '' }; });
    return () => { s.close(); };
  }, []);

  if (me?.removed) return <div className="phone center"><div className="big-emoji">🚫</div><h2>{ui('removed', lang)}</h2></div>;
  if (!content || !pub) return <div className="phone center"><div className="spinner" /><p>{ui('reconnecting', lang)}</p></div>;
  if (needJoin && !me) return <JoinView lang={lang} setLang={setLang} content={content} sock={sock.current!} onJoined={() => setNeedJoin(false)} />;
  if (!me) return <div className="phone center"><div className="spinner" /></div>;

  const sc = content.scenes[pub.scene.idx] as Scene;
  return (
    <div className="phone">
      <header className="ph-head" style={{ ['--team' as any]: me.team.color }}>
        <div className="ph-team"><span className="ph-emoji">{me.team.emoji}</span><span>{tr(me.team.name, lang)}</span></div>
        <div className="ph-name">{me.name}</div>
        <div className="ph-score" aria-label={ui('score', lang)}>{me.score}<small> {ui('points', lang)}</small></div>
        <button className="ph-lang" onClick={() => { const l: Lang = lang === 'en' ? 'ar' : 'en'; setLang(l); sock.current?.emit('lang', l); }}>{lang === 'en' ? 'ع' : 'EN'}</button>
      </header>
      {!online && <div className="offline-bar">📶 {ui('reconnecting', lang)}</div>}
      <main className="ph-main">
        <SceneView key={sc.id} sc={sc} pub={pub} me={me} content={content} lang={lang} sock={sock.current!} />
      </main>
      <button className="ask-fab" onClick={() => setAskOpen(true)}>❓ {ui('askAuditor', lang)}</button>
      {askOpen && <AskSheet lang={lang} sock={sock.current!} onClose={() => setAskOpen(false)} />}
    </div>
  );
}

function JoinView({ lang, setLang, content, sock, onJoined }: { lang: Lang; setLang: (l: Lang) => void; content: Content; sock: Socket; onJoined: () => void }) {
  const [name, setName] = useState(localStorage.getItem('sq-name') || '');
  const [room, setRoom] = useState(qs('r'));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault(); sfx.unlock(); setBusy(true); setErr('');
    sock.timeout(6000).emit('join', { name, room: room || undefined, lang }, (e2: any, r: any) => {
      setBusy(false);
      if (e2 || !r?.ok) { setErr(r?.error === 'bad-room' ? (lang === 'ar' ? 'رقم الغرفة غلط' : 'Wrong room code') : r?.error === 'not-allowed' ? (lang === 'ar' ? 'اختار اسم تاني' : 'Please pick another nickname') : (lang === 'ar' ? 'حاول تاني' : 'Try again')); return; }
      localStorage.setItem(TOKEN_KEY, r.token); localStorage.setItem('sq-name', name);
      (sock as any).auth = { role: 'player', token: r.token };
      buzz(40); sfx.join(); onJoined();
    });
  };
  return (
    <div className="phone join">
      <button className="ph-lang abs" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>{lang === 'en' ? 'عربي' : 'English'}</button>
      <div className="join-logo">🥖</div>
      <h1 className="join-title">{tr(content.meta.title, lang)}</h1>
      <p className="join-sub">{tr(content.meta.subtitle, lang)}</p>
      <form onSubmit={submit} className="join-form">
        <label>{ui('nickname', lang)}<input autoFocus maxLength={16} value={name} onChange={e => setName(e.target.value)} placeholder="Nour" autoComplete="nickname" /></label>
        {!qs('r') && <label>{ui('roomCode', lang)}<input inputMode="numeric" maxLength={4} value={room} onChange={e => setRoom(e.target.value.replace(/\D/g, ''))} placeholder="0000" /></label>}
        {err && <div className="err">{err}</div>}
        <button className="btn-primary" disabled={busy || name.trim().length < 2}>{ui('go', lang)} →</button>
      </form>
      <p className="muted">{ui('noAccount', lang)}</p>
    </div>
  );
}

function AskSheet({ lang, sock, onClose }: { lang: Lang; sock: Socket; onClose: () => void }) {
  const [t, setT] = useState(''); const [done, setDone] = useState('');
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <h3>❓ {ui('askAuditor', lang)}</h3>
        <textarea maxLength={140} value={t} onChange={e => setT(e.target.value)} placeholder={ui('askPh', lang)} rows={3} />
        <div className="row">
          <button className="btn-ghost" onClick={onClose}>✕</button>
          <button className="btn-primary" disabled={t.trim().length < 3} onClick={() => sock.emit('ask', { text: t }, (r: any) => { if (r?.ok) { setDone(ui('sent', lang)); setT(''); setTimeout(onClose, 900); } else setDone('⚠️'); })}>{done || ui('send', lang)}</button>
        </div>
      </div>
    </div>
  );
}

function useCountdown(pub: Pub) {
  const [, force] = useState(0);
  useEffect(() => { const i = setInterval(() => force(x => x + 1), 250); return () => clearInterval(i); }, []);
  return secondsLeft(pub.timer);
}
function TimerPill({ pub }: { pub: Pub }) {
  const s = useCountdown(pub);
  if (pub.phase !== 'answering' || s == null) return null;
  return <div className={`timer-pill ${s <= 5 ? 'hot' : ''}`}>⏱ {s}s</div>;
}

function send(sock: Socket, payload: any) {
  buzz(25);
  return new Promise<any>(res => sock.timeout(5000).emit('answer', payload, (e: any, r: any) => res(e ? { ok: false, error: 'timeout' } : r)));
}

function SceneView({ sc, pub, me, content, lang, sock }: { sc: Scene; pub: Pub; me: Me; content: Content; lang: Lang; sock: Socket }) {
  if (pub.screenOnly && sc.type !== 'lobby' && sc.type !== 'finale') return <EyesUp lang={lang} hint="✋" />;
  switch (sc.type) {
    case 'lobby': return (
      <div className="center">
        <div className="big-emoji">{me.team.emoji}</div>
        <h2>{ui('youreIn', lang)}</h2>
        <div className="team-chip" style={{ background: me.team.color }}>{tr(me.team.name, lang)}</div>
        <p className="muted">{ui('waitStart', lang)}</p>
      </div>);
    case 'story': case 'inventory': return <EyesUp lang={lang} />;
    case 'vote': return <VoteView sc={sc} pub={pub} me={me} lang={lang} sock={sock} />;
    case 'classify': return <ClassifyView sc={sc} pub={pub} me={me} content={content} lang={lang} sock={sock} />;
    case 'calc': case 'methods': return <CalcView sc={sc} pub={pub} me={me} content={content} lang={lang} sock={sock} />;
    case 'board': return <BoardView sc={sc} pub={pub} me={me} content={content} lang={lang} sock={sock} />;
    case 'wordcloud': return <WordView sc={sc} pub={pub} me={me} lang={lang} sock={sock} />;
    case 'finale': return <FinaleCard me={me} lang={lang} content={content} />;
  }
  return null;
}

function EyesUp({ lang, hint }: { lang: Lang; hint?: string }) {
  return <div className="center eyes"><div className="big-emoji">{hint || '👀'}</div><h2>{ui('eyesUp', lang)}</h2></div>;
}
function Waiting({ lang }: { lang: Lang }) { return <div className="locked">🔒 {ui('locked', lang)}</div>; }
function Intro({ lang, title }: { lang: Lang; title?: string }) { return <div className="center"><div className="big-emoji pulse-e">⏳</div><h2>{ui('getReady', lang)}</h2>{title && <p className="muted">{title}</p>}</div>; }

function useResultFx(result: any) {
  const prev = useRef<string>('');
  useEffect(() => {
    if (!result) return;
    const sig = JSON.stringify(result);
    if (sig === prev.current) return;
    const first = prev.current === '';
    prev.current = sig;
    if (first && !result.items) { result.ok ? (sfx.right(), buzz([30, 40, 30])) : (sfx.wrong(), buzz(120)); return; }
    if (!first || result.items) {
      const items = Object.values(result.items || {}) as any[];
      const lastOk = items.length ? items[items.length - 1].ok : result.ok;
      lastOk ? (sfx.right(), buzz([30, 40, 30])) : (sfx.wrong(), buzz(120));
    }
  }, [result]);
}

// ---------------- vote ----------------
function VoteView({ sc, pub, me, lang, sock }: any) {
  const mine = me.answer?.c;
  useResultFx(me.result);
  if (pub.phase === 'intro') return <Intro lang={lang} title={tr(sc.q, lang)} />;
  const rv = pub.revealed?.vote;
  return (
    <div className="q">
      <TimerPill pub={pub} />
      <h2 className="q-text">{tr(sc.q, lang)}</h2>
      <div className="opts">
        {sc.options.map((o: any, i: number) => {
          const isC = rv?.correct === o.id; const isMine = mine === o.id;
          return <button key={o.id} disabled={pub.phase !== 'answering'} className={`opt opt-${i} ${isMine ? 'mine' : ''} ${rv ? (isC ? 'correct' : isMine ? 'wrongpick' : 'faded') : ''}`}
            onClick={() => send(sock, { scene: sc.id, c: o.id })}>{tr(o.t, lang)}</button>;
        })}
      </div>
      {mine && !rv && pub.phase !== 'answering' && <Waiting lang={lang} />}
      {rv && me.result && <div className={`verdict ${me.result.ok ? 'ok' : 'no'}`}>{me.result.ok ? `✅ ${ui('correct', lang)} +${me.result.pts}` : `❌ ${ui('wrong', lang)}`}</div>}
      {rv && <div className="reveal-lines">{(rv.reveal || []).map((l: any, i: number) => <p key={i}>{tr(l, lang)}</p>)}{rv.source && <p className="src">📚 {rv.source}</p>}</div>}
    </div>
  );
}

// ---------------- classify ----------------
function ClassifyView({ sc, pub, me, content, lang, sock }: any) {
  const items = sc.items.map((id: string) => content.items.find((i: any) => i.id === id));
  const ans = me.answer?.items || {};
  const [cur, setCur] = useState(() => Math.max(0, items.findIndex((it: any) => !ans[it.id])));
  const [catFor, setCatFor] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, any>>({});
  const merged = { ...ans, ...local };
  useResultFx(me.result);
  const iso = sc.mode === 'iso';
  const choices = iso ? Object.entries(content.categories.iso).map(([k, v]: any) => ({ id: k, label: tr(v, lang), cls: `iso${k}` }))
    : [{ id: 'S1', label: lang === 'ar' ? 'نطاق 1' : 'Scope 1', cls: 's1' }, { id: 'S2', label: lang === 'ar' ? 'نطاق 2' : 'Scope 2', cls: 's2' }, { id: 'S3', label: lang === 'ar' ? 'نطاق 3' : 'Scope 3', cls: 's3' }];

  if (pub.phase === 'intro') return <Intro lang={lang} title={tr(sc.title, lang)} />;

  if (pub.phase === 'answering') {
    const done = items.every((it: any) => merged[it.id]);
    const firstOpen = items.findIndex((x: any) => !merged[x.id]);
    const idx = cur >= items.length && !done ? firstOpen : Math.min(cur, items.length - 1);
    const it = items[idx];
    const pickScope = async (c: string) => {
      setLocal(l => ({ ...l, [it.id]: { ...(merged[it.id] || {}), c } }));
      await send(sock, { scene: sc.id, item: it.id, c });
      if (c === 'S3' && !iso) { setCatFor(it.id); return; }
      advance();
    };
    const advance = () => { const nx = items.findIndex((x: any, i: number) => i > idx && !merged[x.id] && x.id !== it.id); const back = items.findIndex((x: any) => !merged[x.id] && x.id !== it.id); setCur(nx >= 0 ? nx : back >= 0 ? back : items.length); };
    const pickCat = async (cat: string | null) => {
      if (cat && catFor) { setLocal(l => ({ ...l, [catFor]: { ...(merged[catFor] || {}), c: 'S3', cat } })); await send(sock, { scene: sc.id, item: catFor, c: 'S3', cat }); }
      setCatFor(null); advance();
    };
    if (catFor) return (
      <div className="q">
        <TimerPill pub={pub} />
        <h3 className="cat-q">⭐ {ui('whichCat', lang)}</h3>
        <div className="cats">{Object.entries(content.categories.ghgp).map(([k, v]: any) => <button key={k} className={`cat ${merged[catFor]?.cat === k ? 'mine' : ''}`} onClick={() => pickCat(k)}>{tr(v, lang)}</button>)}</div>
        <button className="btn-ghost wide" onClick={() => pickCat(null)}>{ui('skip', lang)} →</button>
      </div>);
    if (done && cur >= items.length) return (
      <div className="q">
        <TimerPill pub={pub} />
        <Waiting lang={lang} />
        <div className="mylist">{items.map((x: any, i: number) => <button key={x.id} className="myrow" onClick={() => setCur(i)}><span>{x.icon} {tr(x.name, lang)}</span><b className={`tag ${iso ? 'iso' + merged[x.id]?.c : merged[x.id]?.c?.toLowerCase()}`}>{iso ? `ISO ${merged[x.id]?.c}` : merged[x.id]?.c}{merged[x.id]?.cat ? ` · ${merged[x.id].cat}` : ''}</b></button>)}</div>
      </div>);
    return (
      <div className="q classify">
        <TimerPill pub={pub} />
        <div className="dots">{items.map((x: any, i: number) => <span key={x.id} onClick={() => setCur(i)} className={`dot ${i === idx ? 'cur' : ''} ${merged[x.id] ? 'done' : ''}`} />)}</div>
        <div className="card-item">
          <div className="ci-icon">{it.icon}</div>
          <h2>{tr(it.name, lang)}</h2>
          <p>{tr(it.desc, lang)}</p>
        </div>
        <div className={`choices ${iso ? 'iso' : ''}`}>
          {choices.map(ch => <button key={ch.id} className={`choice ${ch.cls} ${merged[it.id]?.c === ch.id ? 'mine' : ''}`} onClick={() => pickScope(ch.id)}>{ch.label}</button>)}
        </div>
      </div>);
  }
  // closed / reveal
  const rv = pub.revealed?.items || {};
  const res = me.result?.items || {};
  const order = [...items].sort((a: any, b: any) => (rv[b.id] ? 1 : 0) - (rv[a.id] ? 1 : 0));
  const latest = sc.items[pub.revealItem];
  return (
    <div className="q">
      {!Object.keys(rv).length && <Waiting lang={lang} />}
      <div className="results">
        {order.map((it: any) => {
          const r = rv[it.id]; const mine = merged[it.id]; const rr = res[it.id];
          const correctLabel = r ? (iso ? [...(r.iso || []), ...(r.isoAlso || [])].map((x: number) => `ISO ${x}`).join(' / ') : `${r.scope}${r.cat ? ' · Cat ' + r.cat : ''}`) : '';
          return (
            <div key={it.id} className={`res ${r ? (rr?.ok ? 'ok' : 'no') : 'pending'} ${latest === it.id && r ? 'latest' : ''}`}>
              <div className="res-top"><span>{it.icon} {tr(it.name, lang)}</span><span className="res-mine">{mine ? (iso ? `ISO ${mine.c}` : mine.c + (mine.cat ? ' · ' + mine.cat : '')) : '—'}</span></div>
              {r ? <>
                <div className="res-verdict">{rr?.ok ? '✅' : '❌'} {correctLabel} {rr?.pts ? <b>+{rr.pts}</b> : null} {rr?.catOk ? <span className="bonus">⭐ {ui('bonus', lang)}</span> : null}</div>
                <div className="res-why">{tr(iso ? r.isoReason : r.reason, lang)}</div>
                <div className="src">📚 {iso ? r.isoSource : r.source}</div>
              </> : <div className="res-wait">⚖️ …</div>}
            </div>);
        })}
      </div>
    </div>);
}

// ---------------- calc / methods ----------------
function CalcView({ sc, pub, me, content, lang, sock }: any) {
  const isM = sc.type === 'methods';
  const calc = isM ? null : content.calcs[sc.calc];
  const doc = isM ? content.methods.doc : calc.doc;
  const myOpt = isM ? content.methods.options[me.method] : null;
  const factor = content.factors.find((f: any) => f.id === (isM ? myOpt.factor : calc.factor));
  const fx = isM && me.method === 'spend' ? content.factors.find((f: any) => f.id === 'fx') : null;
  const [val, setVal] = useState(me.answer?.v != null ? String(me.answer.v) : '');
  const [sent, setSent] = useState(me.answer?.v != null);
  const [showCalc, setShowCalc] = useState(true);
  useResultFx(me.result);
  if (pub.phase === 'intro') return <Intro lang={lang} title={tr(sc.title, lang)} />;
  const rv = isM ? pub.revealed?.methods?.[me.method] : pub.revealed?.calc;
  const submit = async () => { const v = parseFloat(val.replace(/,/g, '')); if (!isFinite(v)) return; const r = await send(sock, { scene: sc.id, v }); if (r?.ok) { setSent(true); sfx.blip(); } };
  return (
    <div className="q calcview">
      <TimerPill pub={pub} />
      {isM && <div className="method-chip">{ui('yourMethod', lang)}: <b>{tr(myOpt.name, lang)}</b></div>}
      <DocCard doc={doc} lang={lang} method={isM ? me.method : undefined} />
      <FactorCard f={factor} lang={lang} />
      {fx && <div className="factor small">💱 {fx.value} {fx.unit} <span className="muted">({fx.source})</span></div>}
      {isM && <p className="hint">💡 {tr(myOpt.hint, lang)}</p>}
      {pub.phase === 'answering' ? <>
        <div className="answer-row" dir="ltr">
          <input inputMode="decimal" value={val} onChange={e => { setVal(e.target.value); setSent(false); }} placeholder="0.0" aria-label={ui('answerIn', lang)} />
          <span className="unit">t CO₂e</span>
          <button className="btn-primary" disabled={!val} onClick={submit}>{sent ? '✓' : ui('submit', lang)}</button>
        </div>
        {sent && <Waiting lang={lang} />}
        <button className="link" onClick={() => setShowCalc(!showCalc)}>{showCalc ? '▾' : '▸'} 🧮</button>
        {showCalc && <Calculator onUse={n => { setVal(String(Math.round(n * 1000) / 1000)); setSent(false); }} />}
      </> : <>
        {me.answer?.v != null && <div className="my-num" dir="ltr">{num(me.answer.v, 2)} t CO₂e</div>}
        {!rv && <Waiting lang={lang} />}
        {rv && <div className={`verdict ${me.result?.ok ? 'ok' : me.result?.close ? 'mid' : 'no'}`}>
          {me.result?.ok ? `✅ ${ui('correct', lang)} +${me.result.pts}` : me.result?.unitSlip ? `⚠️ ${ui('unitSlip', lang)}` : me.result?.close ? `🟡 ${ui('close', lang)} +${me.result.pts}` : `❌ ${ui('wrong', lang)}`}
        </div>}
        {rv && <div className="reveal-lines"><p dir="ltr"><b>{num(rv.answer, 1)} t CO₂e</b></p><p>{tr(rv.formula, lang)}</p><p className="src">📚 {rv.source}</p></div>}
      </>}
    </div>
  );
}

// ---------------- board ----------------
function BoardView({ sc, pub, me, content, lang, sock }: any) {
  const [sel, setSel] = useState<string[]>(me.answer?.levers || []);
  const [sent, setSent] = useState(!!me.answer);
  const budget = Number(content.boardModel.budget);
  const spent = sel.reduce((a, id) => a + content.levers.find((l: any) => l.id === id).cost, 0);
  if (pub.phase === 'intro') return <Intro lang={lang} title={tr(sc.title, lang)} />;
  if (pub.phase !== 'answering') {
    const plan = pub.board?.plans?.[me.teamId] || [];
    return <div className="q"><h3>{me.team.emoji} {ui('waitingPlan', lang)}</h3>
      <div className="mylist">{plan.length ? plan.map((id: string) => { const l = content.levers.find((x: any) => x.id === id); return <div key={id} className="myrow">{l.icon} {tr(l.name, lang)}</div>; }) : <EyesUp lang={lang} />}</div></div>;
  }
  const toggle = (id: string) => { setSent(false); setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]); };
  return (
    <div className="q board">
      <TimerPill pub={pub} />
      <div className="budget"><span>{ui('budget', lang)}</span><div className="bbar"><div style={{ width: `${Math.min(100, 100 * spent / budget)}%` }} className={spent > budget ? 'over' : ''} /></div><b>{budget - spent}</b> {ui('coins', lang)}</div>
      <div className="levers">
        {content.levers.map((l: any) => {
          const on = sel.includes(l.id); const cant = !on && spent + l.cost > budget;
          return <button key={l.id} className={`lever ${on ? 'on' : ''}`} disabled={cant} onClick={() => toggle(l.id)}>
            <span className="lv-ico">{l.icon}</span><span className="lv-t"><b>{tr(l.name, lang)}</b><small>{tr(l.effect, lang)}</small></span><span className="lv-c">🪙{l.cost}</span>
          </button>;
        })}
      </div>
      <button className="btn-primary wide" disabled={spent > budget} onClick={async () => { const r = await send(sock, { scene: sc.id, levers: sel }); if (r?.ok) setSent(true); }}>{sent ? '✓ ' + ui('planSent', lang) : ui('sendPlan', lang)}</button>
    </div>
  );
}

// ---------------- word cloud ----------------
function WordView({ sc, pub, me, lang, sock }: any) {
  const [w, setW] = useState(me.answer?.w || '');
  const [sent, setSent] = useState(!!me.answer?.w);
  if (pub.phase === 'intro') return <Intro lang={lang} title={tr(sc.q, lang)} />;
  if (pub.phase !== 'answering') return <EyesUp lang={lang} />;
  return (
    <div className="q">
      <TimerPill pub={pub} />
      <h2 className="q-text">{tr(sc.q, lang)}</h2>
      <input className="word-in" maxLength={20} value={w} onChange={e => { setW(e.target.value.replace(/\s/g, '')); setSent(false); }} placeholder={ui('oneWord', lang)} />
      <button className="btn-primary wide" disabled={!w} onClick={async () => { const r = await send(sock, { scene: sc.id, w }); if (r?.ok) setSent(true); }}>{sent ? ui('sent', lang) : ui('send', lang)}</button>
    </div>
  );
}

// ---------------- finale ----------------
function FinaleCard({ me, lang, content }: { me: Me; lang: Lang; content: Content }) {
  const c = me.card;
  useEffect(() => { sfx.fanfare(); buzz([60, 60, 60]); }, []);
  if (!c) return <EyesUp lang={lang} />;
  const medal = c.teamRank === 1 ? '🥇' : c.teamRank === 2 ? '🥈' : c.teamRank === 3 ? '🥉' : '🎖️';
  return (
    <div className="center">
      <div className="result-card" style={{ ['--team' as any]: me.team.color }}>
        <div className="rc-top">{tr(content.meta.title, lang)} · {tr(content.meta.company, lang)}</div>
        <div className="rc-name">{me.name}</div>
        <div className="rc-badge">🏅 {tr(c.badge, lang)}</div>
        <div className="rc-line" dir="ltr">{c.classified}/{c.total} {ui('classified', lang)}</div>
        <div className="rc-line">{me.team.emoji} {tr(me.team.name, lang)} {medal}</div>
        <div className="rc-score">{c.score} {ui('points', lang)} · #{c.rank}/{c.of}</div>
      </div>
      <p className="muted">{ui('screenshot', lang)}</p>
    </div>
  );
}
