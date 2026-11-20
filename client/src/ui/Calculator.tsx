import React, { useState } from 'react';

// Safe arithmetic evaluator (+ − × ÷, decimals) with precedence.
export function evaluate(expr: string): number | null {
  const toks = expr.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').match(/(\d+\.?\d*|\.\d+|[+\-*/])/g);
  if (!toks) return null;
  const out: (number | string)[] = []; const ops: string[] = [];
  const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };
  let expectNum = true;
  for (const t of toks) {
    if (/^[\d.]/.test(t)) { out.push(parseFloat(t)); expectNum = false; }
    else {
      if (expectNum) { if (t === '-') { out.push(0); } else return null; }
      while (ops.length && prec[ops[ops.length - 1]] >= prec[t]) out.push(ops.pop()!);
      ops.push(t); expectNum = true;
    }
  }
  while (ops.length) out.push(ops.pop()!);
  const st: number[] = [];
  for (const x of out) {
    if (typeof x === 'number') st.push(x);
    else { const b = st.pop(), a = st.pop(); if (a == null || b == null) return null; st.push(x === '+' ? a + b : x === '-' ? a - b : x === '*' ? a * b : a / b); }
  }
  const r = st.length === 1 ? st[0] : null;
  return r != null && isFinite(r) ? r : null;
}

export function Calculator({ onUse }: { onUse: (n: number) => void }) {
  const [e, setE] = useState('');
  const [last, setLast] = useState<number | null>(null);
  const press = (k: string) => {
    if (k === 'C') { setE(''); setLast(null); return; }
    if (k === '⌫') { setE(e.slice(0, -1)); return; }
    if (k === '=') { const r = evaluate(e); if (r != null) { const s = String(Math.round(r * 1e6) / 1e6); setE(s); setLast(Number(s)); } return; }
    setE((e + k).slice(0, 40)); setLast(null);
  };
  const keys = ['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+'];
  const live = evaluate(e);
  return (
    <div className="calc" dir="ltr">
      <div className="calc-display"><span className="calc-expr">{e || '0'}</span>{live != null && e && !/^[\d.]+$/.test(e) && <span className="calc-live">= {Math.round(live * 1000) / 1000}</span>}</div>
      <div className="calc-keys">
        {keys.map(k => <button key={k} className={`ck ${/[÷×−+]/.test(k) ? 'op' : ''} ${k === '=' ? 'eq' : ''}`} onClick={() => press(k)}>{k}</button>)}
        <button className="ck fn" onClick={() => press('C')}>C</button>
        <button className="ck fn" onClick={() => press('⌫')}>⌫</button>
        <button className="ck use" disabled={(last ?? live) == null} onClick={() => { const v = last ?? live; if (v != null) onUse(v); }}>↓ USE</button>
      </div>
    </div>
  );
}
