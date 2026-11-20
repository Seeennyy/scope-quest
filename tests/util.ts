import { spawn, ChildProcess } from 'node:child_process';
import { io, Socket } from 'socket.io-client';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(__dirname, '..');
export const KEY = 'test-key';
export const PIN = '4321';

export function startServer(port: number, dataDir: string, extra: Record<string, string> = {}): ChildProcess {
  fs.mkdirSync(dataDir, { recursive: true });
  const p = spawn('node', ['dist/server.cjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, HOST_KEY: KEY, HOST_PIN: PIN, SNAPSHOT_MS: '1000', ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
  p.stdout!.on('data', d => process.env.VERBOSE && process.stdout.write('[srv] ' + d));
  p.stderr!.on('data', d => process.stderr.write('[srv-err] ' + d));
  return p;
}
export async function waitHealth(port: number, ms = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(`http://localhost:${port}/api/health`); if (r.ok) return r.json(); } catch { }
    await sleep(100);
  }
  throw new Error('server did not start');
}
export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function host(port: number): Promise<{ s: Socket; last: () => any; cmd: (c: any) => Promise<any>; waitFor: (f: (v: any) => boolean, ms?: number) => Promise<any> }> {
  return new Promise((res, rej) => {
    const s = io(`http://localhost:${port}`, { auth: { role: 'host', key: KEY, pin: PIN }, transports: ['websocket'], forceNew: true });
    let v: any = null; const waiters: { f: (v: any) => boolean; r: (v: any) => void }[] = [];
    s.on('host', (x: any) => { v = x; for (const w of waiters.slice()) if (w.f(x)) { waiters.splice(waiters.indexOf(w), 1); w.r(x); } });
    s.on('connect_error', rej);
    const api = {
      s, last: () => v,
      cmd: (c: any) => Promise.race([new Promise(r => s.emit('cmd', c, (x: any) => setTimeout(() => r(x), 120))), sleep(5000).then(() => { throw new Error('cmd timeout ' + JSON.stringify(c)); })]),
      waitFor: (f: (v: any) => boolean, ms = 5000) => new Promise<any>((r, j) => { if (v && f(v)) return r(v); const w = { f, r }; waiters.push(w); setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) { waiters.splice(i, 1); j(new Error('waitFor timeout')); } }, ms); }),
    };
    s.once('host', () => res(api));
  });
}

export interface P { s: Socket; name: string; token: string; pid: string; pub: any; me: any; recv: { rev: number; at: number }[] }
export function player(port: number, name: string, token = ''): Promise<P> {
  return new Promise((res, rej) => {
    const s = io(`http://localhost:${port}`, { auth: { role: 'player', token }, transports: ['websocket'], forceNew: true, reconnectionDelay: 300 });
    const p: P = { s, name, token, pid: '', pub: null, me: null, recv: [] };
    s.on('pub', (x: any) => { p.pub = x; p.recv.push({ rev: x.rev, at: Date.now() }); });
    s.on('me', (x: any) => { p.me = x; });
    s.on('connect_error', rej);
    if (token) { s.once('me', () => res(p)); return; }
    s.once('need-join', () => s.emit('join', { name }, (r: any) => { if (!r?.ok) return rej(new Error('join failed ' + r?.error)); p.token = r.token; p.pid = r.pid; (s as any).auth = { role: 'player', token: r.token }; res(p); }));
  });
}
