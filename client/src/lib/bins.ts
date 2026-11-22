// Baskets / choices for a classify scene, with display labels.
import type { Content, Lang, Scene } from '../../../shared/types';
import { tr } from './i18n';
import { keyFields, reasonKey } from '../../../shared/engine';

export interface BinView { id: string; icon: string; label: string; hint: string; cls: string }

export function binsOf(sc: Scene, c: Content, lang: Lang): BinView[] {
  if (sc.bins?.length) return sc.bins.map(b => ({ id: b.id, icon: b.icon, label: tr(b.t, lang), hint: tr(b.hint, lang), cls: b.cls }));
  if (sc.mode === 'iso') return Object.entries(c.categories.iso).map(([k, v]) => ({ id: k, icon: '', label: tr(v, lang), hint: '', cls: `iso${k}` }));
  return ['S1', 'S2', 'S3'].map(s => ({ id: s, icon: '', label: lang === 'ar' ? `نطاق ${s[1]}` : `Scope ${s[1]}`, hint: '', cls: s.toLowerCase() }));
}
export const binLabel = (bins: BinView[], id?: string) => { const b = bins.find(x => x.id === id); return b ? b.label : (id || '—'); };

// Correct basket(s) for an item (full content only: host/screen).
export function answerOf(sc: Scene, it: any): string[] {
  if (sc.mode === 'iso') return [...(it.iso || []), ...(it.isoAlso || [])].map(String);
  const kf = keyFields(sc); if (kf) return [it[kf[0]]];
  return [it.scope];
}
export const reasonOf = (sc: Scene, it: any) => it[reasonKey(sc)[0]];
export const sourceOf = (sc: Scene, it: any) => it[reasonKey(sc)[1]];
