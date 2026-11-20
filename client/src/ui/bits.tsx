import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Content, Lang } from '../../../shared/types';
import { tr, num, ui } from '../lib/i18n';
import { secondsLeft } from '../lib/net';
import { sfx } from '../lib/sound';

export function useNow(ms = 250) {
  const [, f] = useState(0);
  useEffect(() => { const i = setInterval(() => f(x => x + 1), ms); return () => clearInterval(i); }, [ms]);
}

export function Countdown({ timer, phase, skew = 0, size = 150, sound = true }: { timer: any; phase: string; skew?: number; size?: number; sound?: boolean }) {
  useNow(200);
  const s = secondsLeft(timer, skew);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!sound || phase !== 'answering' || s == null || s === last.current) return;
    last.current = s;
    if (s <= 5 && s > 0) sfx.tick(); if (s === 0) sfx.buzzer();
  }, [s, phase, sound]);
  if (s == null || timer.duration === 0) return null;
  const frac = Math.max(0, Math.min(1, s / (timer.duration || 1)));
  const r = 44, C = 2 * Math.PI * r;
  return (
    <div className={`countdown ${s <= 5 && phase === 'answering' ? 'hot' : ''} ${!timer.endsAt ? 'paused' : ''}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r={r} className="cd-bg" /><circle cx="50" cy="50" r={r} className="cd-fg" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} /></svg>
      <span>{s}</span>
    </div>
  );
}

export function Confetti({ n = 140 }: { n?: number }) {
  const bits = useMemo(() => Array.from({ length: n }, (_, i) => ({
    l: Math.random() * 100, d: Math.random() * 1.5, t: 2.5 + Math.random() * 2.5, c: ['#c8553d', '#1f7a8c', '#e0a526', '#2d6a4f', '#8e2c58', '#5a4fcf'][i % 6], r: Math.random() * 360, w: 8 + Math.random() * 10,
  })), [n]);
  return <div className="confetti">{bits.map((b, i) => <i key={i} style={{ left: `${b.l}%`, animationDelay: `${b.d}s`, animationDuration: `${b.t}s`, background: b.c, transform: `rotate(${b.r}deg)`, width: b.w, height: b.w * 0.45 }} />)}</div>;
}

export function Bars({ rows, total, correct, show = true }: { rows: { id: string; label: string; cls?: string; n: number }[]; total: number; correct?: string[]; show?: boolean }) {
  return (
    <div className="bars">
      {rows.map(r => {
        const pct = total ? Math.round(100 * r.n / total) : 0;
        const ok = correct?.includes(r.id);
        return (
          <div key={r.id} className={`bar ${r.cls || ''} ${correct ? (ok ? 'correct' : 'dimmed') : ''}`}>
            <div className="bar-label">{r.label}</div>
            <div className="bar-track"><div className="bar-fill" style={{ width: show ? `${Math.max(pct, 1)}%` : '0%' }} /></div>
            <div className="bar-pct">{show ? `${pct}%` : ''}</div>
          </div>
        );
      })}
    </div>
  );
}

export function ScopeStack({ inv, lang, highlight, vh = 45 }: { inv: any; lang: Lang; highlight?: string; vh?: number }) {
  if (!inv) return null;
  const height = Math.round(vh * (typeof window !== 'undefined' ? window.innerHeight : 1000) / 100);
  const cols = ['S1', 'S2', 'S3'];
  const max = Math.max(...cols.map(c => inv.tot[c] || 0), 200);
  const scale = (height * 0.52) / max;
  return (
    <div className="stack" style={{ height }}>
      {cols.map(c => {
        const rows = inv.rows.filter((r: any) => r.scope === c && r.done);
        return (
          <div key={c} className="stack-col">
            <div className="stack-total" dir="ltr">{num(inv.tot[c] || 0, 0)} t</div>
            <div className="stack-bar">
              {rows.map((r: any) => (
                <div key={r.id} className={`blk ${c.toLowerCase()} ${r.pre ? 'pre' : ''} ${highlight === r.id ? 'drop' : ''}`} style={{ height: Math.max(4, r.value * scale) }} title={tr(r.label, lang)}>
                  {r.value * scale > height * 0.07 && <span>{tr(r.label, lang)} · {num(r.value, 1)}</span>}
                </div>
              ))}
            </div>
            <div className={`stack-name ${c.toLowerCase()}`}>{lang === 'ar' ? `النطاق ${c[1]}` : `Scope ${c[1]}`}</div>
          </div>
        );
      })}
    </div>
  );
}

export function TeamName({ c, id, lang }: { c: Content; id: string; lang: Lang }) {
  const t = c.teams.find(x => x.id === id); if (!t) return null;
  return <span className="tname" style={{ color: t.color }}>{t.emoji} {tr(t.name, lang)}</span>;
}

export function LeaderboardPanel({ lb, c, lang }: { lb: any; c: Content; lang: Lang }) {
  if (!lb) return null;
  const max = Math.max(1, ...lb.teams.map((t: any) => t.score));
  return (
    <div className="lb">
      <h2>🏆 {ui('leaderboard', lang)}</h2>
      <div className="lb-teams">
        {lb.teams.map((t: any, i: number) => {
          const tm = c.teams.find(x => x.id === t.id)!;
          return (
            <div key={t.id} className="lb-row">
              <span className="lb-rank">{i + 1}</span>
              <span className="lb-name">{tm.emoji} {tr(tm.name, lang)} <small>({t.members})</small></span>
              <div className="lb-track"><div className="lb-fill" style={{ width: `${100 * t.score / max}%`, background: tm.color }} /></div>
              <span className="lb-score">{t.score}</span>
            </div>
          );
        })}
      </div>
      <div className="lb-top">{lb.top.slice(0, 5).map((p: any, i: number) => <span key={i} className="lb-p">{['🥇', '🥈', '🥉', '4', '5'][i]} {p.name} <b>{p.score}</b></span>)}</div>
    </div>
  );
}
