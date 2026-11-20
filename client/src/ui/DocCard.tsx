import React from 'react';
import type { Doc, Lang, Factor } from '../../../shared/types';
import { tr } from '../lib/i18n';

const KIND_ICON: Record<string, string> = { invoice: '🧾', bill: '💡', log: '📋', sheet: '🗂️' };

export function DocCard({ doc, lang, method, big }: { doc: Doc; lang: Lang; method?: string; big?: boolean }) {
  return (
    <div className={`doc doc-${doc.kind} ${big ? 'big' : ''}`}>
      <div className="doc-head"><span className="doc-ico">{KIND_ICON[doc.kind] || '📄'}</span><span>{tr(doc.from, lang)}</span></div>
      <table className="doc-lines"><tbody>
        {doc.lines.map((l, i) => (
          <tr key={i} className={`${l.hl ? 'hl' : ''} ${method && l.m === method ? 'hl mine' : ''} ${method && l.m && l.m !== method ? 'dim' : ''}`}>
            <td>{tr(l.k, lang)}</td><td className="v">{tr(l.v, lang)}</td>
          </tr>
        ))}
      </tbody></table>
      <div className="doc-foot">Nile Loaf · FY2026</div>
    </div>
  );
}

export function FactorCard({ f, lang }: { f: Factor; lang: Lang }) {
  return (
    <div className="factor">
      <div className="factor-k">{lang === 'ar' ? 'معامل الانبعاث' : 'Emission factor'}</div>
      <div className="factor-v" dir="ltr">{f.value.toLocaleString('en-US', { maximumFractionDigits: 5 })} <small>{f.unit}</small></div>
      <div className="factor-n">{f.name}</div>
      <div className="factor-s">{f.source}</div>
    </div>
  );
}
