import React, { useEffect, useMemo, useRef, useState } from 'react';
import { qs } from '../lib/net';

const SECTIONS: [string, string][] = [
  ['meta', 'Meta (instructor name, company…)'], ['scenes', 'Scenes & story lines'], ['items', 'Emission sources (answer keys)'],
  ['calcs', 'Evidence files (calculations)'], ['methods', 'One trip, three methods'], ['factors', 'Emission factors'],
  ['prefilled', 'Pre-filled inventory lines'], ['levers', 'Board levers'], ['boardModel', 'Board model'], ['sources', 'Source labels'],
  ['teams', 'Teams'], ['categories', 'Category names'], ['__raw', '{ } Raw JSON'],
];

export default function Admin() {
  const key = qs('k');
  const [pin, setPin] = useState(sessionStorage.getItem('sq-pin') || '');
  const [draft, setDraft] = useState<any>(null);
  const [orig, setOrig] = useState('');
  const [sec, setSec] = useState('meta');
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [raw, setRaw] = useState('');
  const [preview, setPreview] = useState('coldopen');
  const frame = useRef<HTMLIFrameElement>(null);

  const load = (p = pin) => fetch(`/api/admin/content?k=${encodeURIComponent(key)}&pin=${encodeURIComponent(p)}`).then(r => { if (!r.ok) throw new Error('PIN'); return r.text(); })
    .then(t => { setOrig(t); setDraft(JSON.parse(t)); setRaw(t); sessionStorage.setItem('sq-pin', p); setMsg(null); }).catch(() => setMsg({ t: 'Wrong PIN', ok: false }));
  useEffect(() => { if (pin) load(); }, []);
  useEffect(() => { const t = setTimeout(() => frame.current?.contentWindow?.postMessage({ type: 'sq-preview', content: draft }, location.origin), 300); return () => clearTimeout(t); }, [draft, preview]);
  const dirty = useMemo(() => draft && JSON.stringify(draft, null, 2) !== orig, [draft, orig]);

  const save = async () => {
    const r = await fetch(`/api/admin/content?k=${encodeURIComponent(key)}&pin=${encodeURIComponent(pin)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(draft) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setOrig(JSON.stringify(draft, null, 2)); setMsg({ t: 'Saved ✔ Live for everyone, no redeploy needed.', ok: true }); }
    else setMsg({ t: 'Not saved: ' + (j.errors || ['error']).join(' · '), ok: false });
  };

  if (!draft) return (
    <div className="host login"><h1>✏️ Content editor</h1>
      <form onSubmit={e => { e.preventDefault(); load(pin); }}><input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="PIN" autoFocus /><button className="btn-primary">Open</button></form>
      {msg && <p className="err">{msg.t}</p>}</div>);

  return (
    <div className="admin">
      <aside className="adm-nav">
        <h2>✏️ Scope Quest content</h2>
        {SECTIONS.map(([k, l]) => <button key={k} className={sec === k ? 'on' : ''} onClick={() => { setSec(k); if (k === '__raw') setRaw(JSON.stringify(draft, null, 2)); }}>{l}</button>)}
        <div className="adm-actions">
          <button className="btn-primary" disabled={!dirty} onClick={save}>💾 Save {dirty ? '•' : ''}</button>
          <button onClick={() => { setDraft(JSON.parse(orig)); setMsg(null); }} disabled={!dirty}>↺ Discard</button>
          <a className="btn-link" href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(draft, null, 2))}`} download="content.json">⬇️ Download JSON</a>
          <button onClick={async () => { if (!confirm('Restore the original content shipped with the app?')) return; await fetch(`/api/admin/content/reset?k=${encodeURIComponent(key)}&pin=${encodeURIComponent(pin)}`, { method: 'POST' }); load(); }}>⟲ Restore defaults</button>
        </div>
        {msg && <p className={msg.ok ? 'okmsg' : 'err'}>{msg.t}</p>}
      </aside>
      <main className="adm-main">
        {sec === '__raw'
          ? <div className="raw"><textarea value={raw} onChange={e => setRaw(e.target.value)} spellCheck={false} /><button onClick={() => { try { setDraft(JSON.parse(raw)); setMsg({ t: 'JSON applied to draft. Press Save to publish.', ok: true }); } catch (e: any) { setMsg({ t: 'JSON error: ' + e.message, ok: false }); } }}>Apply JSON to draft</button></div>
          : <Node value={draft[sec]} path={[sec]} onChange={(p, val) => setDraft(setIn(draft, p, val))} />}
      </main>
      <section className="adm-preview">
        <div className="row"><b>Preview</b><select value={preview} onChange={e => setPreview(e.target.value)}>{draft.scenes.map((s: any) => <option key={s.id} value={s.id}>{s.id}</option>)}</select></div>
        <iframe ref={frame} key={preview} src={`/screen?k=${encodeURIComponent(key)}&preview=${preview}`} onLoad={() => frame.current?.contentWindow?.postMessage({ type: 'sq-preview', content: draft }, location.origin)} />
        <p className="muted small">Preview shows the projector view of the selected scene with your unsaved draft.</p>
      </section>
    </div>);
}

function setIn(obj: any, path: (string | number)[], val: any): any {
  if (!path.length) return val;
  const [h, ...t] = path;
  const copy = Array.isArray(obj) ? obj.slice() : { ...obj };
  copy[h as any] = setIn(obj?.[h as any], t, val);
  return copy;
}

function Node({ value, path, onChange }: { value: any; path: (string | number)[]; onChange: (p: (string | number)[], v: any) => void }) {
  const label = String(path[path.length - 1]);
  if (value === null || value === undefined) return <div className="fld"><label>{label}</label><input value="" onChange={e => onChange(path, e.target.value)} placeholder="(empty)" /></div>;
  if (typeof value === 'string') {
    const long = value.length > 60 || /talk|misconception|reason|desc|note|source|clause|follow/.test(label);
    return <div className={`fld ${label === 'ar' ? 'rtl' : ''}`}><label>{label}</label>{long ? <textarea dir={label === 'ar' ? 'rtl' : 'ltr'} value={value} rows={Math.min(5, Math.ceil(value.length / 70) + 1)} onChange={e => onChange(path, e.target.value)} /> : <input dir={label === 'ar' ? 'rtl' : 'ltr'} value={value} onChange={e => onChange(path, e.target.value)} />}</div>;
  }
  if (typeof value === 'number') return <div className="fld"><label>{label}</label><input type="number" step="any" value={value} onChange={e => onChange(path, e.target.value === '' ? 0 : Number(e.target.value))} /></div>;
  if (typeof value === 'boolean') return <div className="fld"><label><input type="checkbox" checked={value} onChange={e => onChange(path, e.target.checked)} /> {label}</label></div>;
  if (Array.isArray(value) && value.every(x => typeof x !== 'object')) return <div className="fld"><label>{label} <small>(comma-separated)</small></label><input value={value.join(', ')} onChange={e => onChange(path, e.target.value.split(',').map(s => s.trim()).filter(Boolean).map(s => (typeof value[0] === 'number' && !isNaN(Number(s)) ? Number(s) : s)))} /></div>;
  const entries = Array.isArray(value) ? value.map((v, i) => [i, v] as [number, any]) : Object.entries(value);
  const title = (v: any, k: any) => v && typeof v === 'object' ? (v.id ? `${v.id}${v.type ? ' · ' + v.type : ''}` : v.en ? v.en.slice(0, 50) : String(k)) : String(k);
  return (
    <fieldset className="grp">
      <legend>{label}</legend>
      {entries.map(([k, v]) => typeof v === 'object' && v !== null && !(v.en !== undefined && Object.keys(v).length <= 2)
        ? <details key={k} className="sub"><summary>{title(v, k)}</summary><Node value={v} path={[...path, k]} onChange={onChange} /></details>
        : <Node key={k} value={v} path={[...path, k]} onChange={onChange} />)}
    </fieldset>);
}
