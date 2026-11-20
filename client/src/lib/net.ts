import { io, Socket } from 'socket.io-client';
import type { Content } from '../../../shared/types';

export function connect(auth: Record<string, any>): Socket {
  return io({ auth, transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 500, reconnectionDelayMax: 2000, timeout: 8000 });
}
export async function fetchContent(full = false, key = ''): Promise<Content> {
  const r = await fetch(full ? `/api/content/full?k=${encodeURIComponent(key)}` : '/api/content', { cache: 'no-store' });
  if (!r.ok) throw new Error('content ' + r.status);
  const c = await r.json();
  try { localStorage.setItem(full ? 'sq-content-full' : 'sq-content', JSON.stringify(c)); } catch { }
  return c;
}
export function cachedContent(full = false): Content | null {
  try { const t = localStorage.getItem(full ? 'sq-content-full' : 'sq-content'); return t ? JSON.parse(t) : null; } catch { return null; }
}
export const qs = (k: string) => new URLSearchParams(location.search).get(k) || '';

// Server-time-corrected countdown
export function secondsLeft(timer: { endsAt: number | null; remaining: number | null }, skew = 0) {
  if (timer.endsAt) return Math.max(0, Math.ceil((timer.endsAt - (Date.now() + skew)) / 1000));
  return timer.remaining == null ? null : Math.ceil(timer.remaining);
}
