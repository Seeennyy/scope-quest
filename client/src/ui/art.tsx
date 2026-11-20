// Original illustrations (SVG): CEO, auditor stamp, Nile Loaf map.
import React from 'react';
import type { Item, Lang } from '../../../shared/types';
import { tr } from '../lib/i18n';

export function CeoAvatar({ size = 160, talking = false }: { size?: number; talking?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-label="CEO" className={talking ? 'ceo talking' : 'ceo'}>
      <circle cx="100" cy="100" r="96" fill="#f3c86b" />
      <path d="M30 200 C35 150 60 135 100 135 C140 135 165 150 170 200 Z" fill="#1f7a8c" />
      <path d="M85 135 L100 165 L115 135 Z" fill="#fff8ec" />
      <rect x="88" y="112" width="24" height="28" rx="10" fill="#b9784f" />
      <ellipse cx="100" cy="88" rx="40" ry="46" fill="#c98a5e" />
      <path d="M58 86 C55 40 85 30 103 32 C135 34 150 55 142 92 C138 70 125 58 100 58 C78 58 66 70 58 86 Z" fill="#2b1d16" />
      <circle cx="61" cy="100" r="5" fill="#e0a526" /><circle cx="139" cy="100" r="5" fill="#e0a526" />
      <circle cx="85" cy="88" r="5" fill="#1b1b2f" /><circle cx="115" cy="88" r="5" fill="#1b1b2f" />
      <path d="M76 78 Q85 73 93 77" stroke="#2b1d16" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M107 77 Q115 73 124 78" stroke="#2b1d16" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <circle cx="85" cy="88" r="12" fill="none" stroke="#1b1b2f" strokeWidth="3" />
      <circle cx="115" cy="88" r="12" fill="none" stroke="#1b1b2f" strokeWidth="3" />
      <path d="M97 88 h6" stroke="#1b1b2f" strokeWidth="3" />
      <path className="mouth" d="M88 110 Q100 120 112 110" stroke="#7a2f22" strokeWidth="4" fill="#7a2f22" strokeLinecap="round" />
      <g transform="translate(118 150) rotate(-12)">
        <ellipse cx="30" cy="20" rx="34" ry="20" fill="#d9a066" stroke="#9c6430" strokeWidth="3" />
        <path d="M8 18 Q30 6 52 18" stroke="#f3d3a3" strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

export function Stamp({ name, label, short, show }: { name: string; label: string; short?: string; show: boolean }) {
  if (!show) return null;
  return (
    <>
      <div className="stamp-wrap" aria-hidden="true">
        <div className="stamp">
          <div className="stamp-check">✔</div>
          <div className="stamp-text">{label}</div>
          <div className="stamp-name">{name}</div>
        </div>
      </div>
    </>
  );
}

const PLACES: { x: number; y: number; w: number; h: number; label: { en: string; ar: string }; color: string; roof?: string }[] = [
  { x: 50, y: 60, w: 170, h: 90, label: { en: 'Wheat farms', ar: 'مزارع القمح' }, color: '#e8c35a', roof: '#b98b2a' },
  { x: 170, y: 190, w: 180, h: 120, label: { en: 'Delta Mills', ar: 'مطاحن الدلتا' }, color: '#e6d2b0', roof: '#8d6e4c' },
  { x: 360, y: 250, w: 320, h: 230, label: { en: 'Nile Loaf bakery', ar: 'مخبز نايل لوف' }, color: '#f2c9a0', roof: '#c8553d' },
  { x: 690, y: 210, w: 170, h: 140, label: { en: 'Head office', ar: 'المكتب الرئيسي' }, color: '#d9e4ea', roof: '#5a6b78' },
  { x: 800, y: 430, w: 360, h: 230, label: { en: 'Depot', ar: 'الجراج' }, color: '#e4dccd', roof: '#6b5b45' },
  { x: 1240, y: 120, w: 200, h: 140, label: { en: 'Van factory', ar: 'مصنع الفانات' }, color: '#cfd5dc', roof: '#4d5866' },
  { x: 1380, y: 30, w: 200, h: 120, label: { en: 'Airport', ar: 'المطار' }, color: '#dfe7f2', roof: '#3d5a80' },
  { x: 1330, y: 430, w: 230, h: 170, label: { en: 'Power plant', ar: 'محطة الكهرباء' }, color: '#d6d0c4', roof: '#555' },
  { x: 1120, y: 690, w: 300, h: 180, label: { en: 'Staff homes', ar: 'بيوت الموظفين' }, color: '#f0d9c8', roof: '#b5654b' },
  { x: 560, y: 700, w: 480, h: 170, label: { en: 'Customers', ar: 'العملاء' }, color: '#f6e1b8', roof: '#d08c2e' },
  { x: 240, y: 580, w: 240, h: 150, label: { en: 'Courier hub', ar: 'مركز الشحن' }, color: '#e3d7f0', roof: '#6c4f9e' },
];

export function NileMap({ items, lit, done, lang, focus }: { items: Item[]; lit: string[]; done?: Record<string, string>; lang: Lang; focus?: string }) {
  return (
    <svg viewBox="0 0 1600 900" className="nilemap" role="img" aria-label="Map of Nile Loaf">
      <defs>
        <pattern id="sand" width="40" height="40" patternUnits="userSpaceOnUse"><rect width="40" height="40" fill="#f7ecd6" /><circle cx="8" cy="10" r="1.6" fill="#e8d6b3" /><circle cx="28" cy="30" r="1.4" fill="#e8d6b3" /></pattern>
        <filter id="glow"><feGaussianBlur stdDeviation="8" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <rect width="1600" height="900" fill="url(#sand)" />
      <path d="M0 520 C120 470 160 380 250 340 C330 300 300 180 360 120 C400 80 420 30 440 0 L520 0 C500 40 470 100 430 150 C380 210 400 330 320 390 C240 450 200 540 0 610 Z" fill="#5fb3c6" />
      <path d="M0 560 C140 505 190 420 270 375 C350 330 330 200 390 130 C420 95 450 50 470 0" stroke="#a9dbe6" strokeWidth="5" fill="none" strokeDasharray="18 22" opacity="0.8" />
      <path d="M90 520 l26 -46 l26 46 Z" fill="#fff" stroke="#1b1b2f" strokeWidth="3" /><path d="M116 474 v52" stroke="#1b1b2f" strokeWidth="3" /><path d="M76 528 q40 16 80 0" stroke="#7a4b2a" strokeWidth="7" fill="none" />
      <path d="M720 40 l60 -38 l60 38 Z" fill="#e0b55d" opacity="0.6" /><path d="M820 46 l44 -28 l44 28 Z" fill="#e0b55d" opacity="0.5" />
      <path d="M100 880 L1560 880" stroke="#c9b48c" strokeWidth="6" strokeDasharray="30 18" opacity="0.5" />
      {PLACES.map((p, i) => (
        <g key={i}>
          <rect x={p.x} y={p.y + 18} width={p.w} height={p.h - 18} rx="14" fill={p.color} stroke="#1b1b2f" strokeWidth="3" />
          <rect x={p.x - 6} y={p.y} width={p.w + 12} height="26" rx="10" fill={p.roof} stroke="#1b1b2f" strokeWidth="3" />
          <text x={p.x + p.w / 2} y={p.y + p.h - 12} textAnchor="middle" className="map-label">{tr(p.label, lang)}</text>
        </g>
      ))}
      {items.map(it => {
        const on = lit.includes(it.id); const d = done?.[it.id]; const f = focus === it.id;
        return (
          <g key={it.id} transform={`translate(${it.pos[0]} ${it.pos[1]})`} className={`hot ${on ? 'on' : 'off'} ${f ? 'focus' : ''}`}>
            {on && <circle r="62" className="pulse" />}
            <circle r={on ? 46 : 30} fill={d ? `var(--${d.toLowerCase()})` : on ? '#fff' : '#ffffffaa'} stroke="#1b1b2f" strokeWidth={on ? 5 : 3} filter={on ? 'url(#glow)' : undefined} />
            <text y={on ? 16 : 11} textAnchor="middle" fontSize={on ? 46 : 30}>{it.icon}</text>
            {d && <text y={-56} textAnchor="middle" className="hot-tag">{d.startsWith('S') ? d : `ISO ${d}`}</text>}
          </g>
        );
      })}
    </svg>
  );
}
