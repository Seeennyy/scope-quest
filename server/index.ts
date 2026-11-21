import express from 'express';
import compression from 'compression';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Server, Socket } from 'socket.io';
import QRCode from 'qrcode';
import type { Content, GameState, HostCmd } from '../shared/types';
import { newState, hostCommand, addPlayer, submitAnswer, tick, sceneOf, touch, activePlayers, isAnswerScene } from '../shared/engine';
import { publicContent, playerPublicView, playerPrivateView, screenView, hostView, statsReport, exportCsv } from '../shared/views';
import { cleanName, cleanText } from './profanity';
import { scheduleBots, cancelBots, makeBots } from './bots';

const ROOT = path.resolve(process.env.APP_ROOT || process.cwd());
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const HOST_KEY = process.env.HOST_KEY || 'dev-host-key';
const HOST_PIN = process.env.HOST_PIN || '1234';
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '');
const SNAPSHOT_MS = Number(process.env.SNAPSHOT_MS || 2000);
const CLIENT_DIR = path.join(ROOT, 'dist', 'client');
try { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.accessSync(DATA_DIR, fs.constants.W_OK); }
catch (e: any) { console.error(`WARNING: data dir ${DATA_DIR} is not writable (${e.code}). The game runs, but a restart will lose scores. On Railway set RAILWAY_RUN_UID=0 and mount the volume at /app/data.`); }

const log = (...a: any[]) => console.log(new Date().toISOString(), ...a);
const safeEq = (a: string, b: string) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const isHost = (k?: any, pin?: any) => safeEq(String(k || ''), HOST_KEY) && safeEq(String(pin || ''), HOST_PIN);
const isKey = (k?: any) => safeEq(String(k || ''), HOST_KEY);

// ---------------- content ----------------
const CONTENT_RUNTIME = path.join(DATA_DIR, 'content.json');
const CONTENT_DEFAULT = path.join(ROOT, 'content', 'content.json');
export function validateContent(c: any): string[] {
  const errs: string[] = [];
  if (!c || typeof c !== 'object') return ['not an object'];
  for (const k of ['meta', 'teams', 'items', 'scenes', 'factors', 'calcs', 'methods', 'levers', 'sources', 'categories', 'boardModel', 'prefilled']) if (!(k in c)) errs.push(`missing "${k}"`);
  if (errs.length) return errs;
  const ids = new Set(c.items.map((i: any) => i.id));
  const fids = new Set(c.factors.map((f: any) => f.id));
  if (c.teams.length < 4) errs.push('need at least 4 teams');
  for (const sc of c.scenes) {
    if (!sc.id || !sc.type) errs.push(`scene without id/type`);
    if (sc.type === 'classify') for (const i of sc.items || []) if (!ids.has(i)) errs.push(`scene ${sc.id}: unknown item ${i}`);
    if (sc.type === 'calc' && !c.calcs[sc.calc]) errs.push(`scene ${sc.id}: unknown calc ${sc.calc}`);
    if (sc.type === 'vote' && !sc.poll && !(sc.options || []).some((o: any) => o.id === sc.correct)) errs.push(`scene ${sc.id}: correct option missing`);
  }
  for (const [k, v] of Object.entries<any>(c.calcs)) { if (!fids.has(v.factor)) errs.push(`calc ${k}: unknown factor ${v.factor}`); if (!(v.answer > 0)) errs.push(`calc ${k}: answer must be > 0`); }
  for (const [k, v] of Object.entries<any>(c.methods.options)) if (!(v.answer > 0)) errs.push(`method ${k}: answer must be > 0`);
  for (const it of c.items) { if (!it.name?.en || !it.name?.ar) errs.push(`item ${it.id}: name needs en+ar`); if (it.scope && !['S1', 'S2', 'S3'].includes(it.scope)) errs.push(`item ${it.id}: bad scope`); }
  if (c.scenes[0]?.type !== 'lobby') errs.push('first scene must be the lobby');
  return errs;
}
function loadContent(): Content {
  const file = fs.existsSync(CONTENT_RUNTIME) ? CONTENT_RUNTIME : CONTENT_DEFAULT;
  const c = JSON.parse(fs.readFileSync(file, 'utf8'));
  const errs = validateContent(c);
  if (errs.length) throw new Error(`Invalid content ${file}: ${errs.join('; ')}`);
  return c;
}
let content: Content = loadContent();
let pubContentJson = JSON.stringify(publicContent(content));
let fullContentJson = JSON.stringify(content);

// ---------------- state ----------------
const SNAP = path.join(DATA_DIR, 'snapshot.json');
let state: GameState;
function freshRoom() { return String(Math.floor(1000 + Math.random() * 9000)); }
try {
  const snap = JSON.parse(fs.readFileSync(SNAP, 'utf8'));
  if (snap?.v === 1 && snap.players) {
    state = snap;
    for (const p of Object.values(state.players)) p.connected = !!p.bot; // sockets are gone after restart
    log(`Resumed session ${state.sessionId}: ${Object.keys(state.players).length} players, scene ${state.sceneIdx} (${sceneOf(state, content).id}), phase ${state.phase}`);
  } else throw new Error('no snapshot');
} catch {
  state = newState(freshRoom(), Date.now());
  log(`New session ${state.sessionId}, room ${state.roomCode}`);
}
let snapDirty = true;
function writeSnapshot() {
  if (!snapDirty) return;
  const tmp = SNAP + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, SNAP);
  snapDirty = false;
}

// ---------------- http ----------------
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true); // behind Caddy / Railway / Render: use the real https scheme for the QR link
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use('/assets', express.static(path.join(CLIENT_DIR, 'assets'), { immutable: true, maxAge: '30d' }));
app.use(express.static(CLIENT_DIR, { index: false, maxAge: '1h' }));

const indexHtml = () => fs.readFileSync(path.join(CLIENT_DIR, 'index.html'), 'utf8');
const sendApp = (_req: express.Request, res: express.Response) => { res.set('Cache-Control', 'no-cache'); res.type('html').send(indexHtml()); };
app.get(['/', '/play', '/join'], sendApp);
app.get('/screen', (req, res) => isKey(req.query.k) ? sendApp(req, res) : res.status(404).send('Not found'));
app.get(['/host', '/admin', '/stats'], (req, res) => isKey(req.query.k) ? sendApp(req, res) : res.status(404).send('Not found'));

app.get('/api/health', (_req, res) => res.json({ ok: true, session: state.sessionId, players: activePlayers(state).length, scene: sceneOf(state, content).id }));
app.get('/api/content', (_req, res) => { res.type('json').set('Cache-Control', 'no-cache').send(pubContentJson); });
app.get('/api/content/full', (req, res) => isKey(req.query.k) ? res.type('json').set('Cache-Control', 'no-store').send(fullContentJson) : res.status(403).end());
app.get('/api/qr.svg', async (req, res) => {
  const url = String(req.query.u || '').slice(0, 300);
  if (!/^https?:\/\//.test(url)) return res.status(400).end();
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1b1b1b', light: '#ffffff' } });
  res.type('image/svg+xml').set('Cache-Control', 'public, max-age=3600').send(svg);
});
app.get('/api/join-url', (req, res) => {
  const base = PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
  res.json({ url: `${base}/?r=${state.roomCode}`, short: base.replace(/^https?:\/\//, ''), room: state.roomCode });
});
app.get('/api/export.csv', (req, res) => {
  if (!isHost(req.query.k, req.query.pin)) return res.status(403).end();
  res.type('text/csv').set('Content-Disposition', `attachment; filename="scope-quest-${state.sessionId}.csv"`).send('﻿' + exportCsv(state, content));
});
app.get('/api/stats', (req, res) => isHost(req.query.k, req.query.pin) ? res.json({ session: state.sessionId, players: activePlayers(state).length, rows: statsReport(state, content) }) : res.status(403).end());
app.get('/api/admin/content', (req, res) => isHost(req.query.k, req.query.pin) ? res.type('json').send(JSON.stringify(content, null, 2)) : res.status(403).end());
app.post('/api/admin/content', (req, res) => {
  if (!isHost(req.query.k, req.query.pin)) return res.status(403).end();
  const c = req.body;
  const errs = validateContent(c);
  if (errs.length) return res.status(400).json({ ok: false, errors: errs });
  if (fs.existsSync(CONTENT_RUNTIME)) fs.copyFileSync(CONTENT_RUNTIME, path.join(DATA_DIR, `content.backup-${Date.now()}.json`));
  fs.writeFileSync(CONTENT_RUNTIME, JSON.stringify(c, null, 2));
  content = c; pubContentJson = JSON.stringify(publicContent(content)); fullContentJson = JSON.stringify(content);
  if (state.sceneIdx >= content.scenes.length) state.sceneIdx = content.scenes.length - 1;
  touch(state, Date.now()); snapDirty = true;
  io.emit('content', { at: Date.now() });
  log('Content updated via /admin');
  res.json({ ok: true });
});
app.post('/api/admin/content/reset', (req, res) => {
  if (!isHost(req.query.k, req.query.pin)) return res.status(403).end();
  if (fs.existsSync(CONTENT_RUNTIME)) fs.renameSync(CONTENT_RUNTIME, path.join(DATA_DIR, `content.backup-${Date.now()}.json`));
  content = loadContent(); pubContentJson = JSON.stringify(publicContent(content)); fullContentJson = JSON.stringify(content);
  touch(state, Date.now()); io.emit('content', { at: Date.now() });
  res.json({ ok: true });
});
app.use((_req, res) => res.status(404).send('Not found'));

const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 10000, pingTimeout: 8000, maxHttpBufferSize: 1e5,
  perMessageDeflate: false,
  cors: { origin: false },
});

// ---------------- sockets ----------------
const socketsByPid = new Map<string, Set<string>>();
const dirtyPids = new Set<string>();
let answersDirty = true;

function bindPlayer(sock: Socket, pid: string) {
  sock.data.pid = pid; sock.join('players');
  let set = socketsByPid.get(pid); if (!set) socketsByPid.set(pid, set = new Set());
  set.add(sock.id);
  const p = state.players[pid];
  if (!p.connected) { p.connected = true; answersDirty = true; }
  dirtyPids.add(pid);
  sock.emit('pub', playerPublicView(state, content));
  sock.emit('me', playerPrivateView(state, content, pid));
}

io.on('connection', (sock) => {
  const auth = sock.handshake.auth || {};
  const role = String(auth.role || 'player');
  if (role === 'host') {
    if (!isHost(auth.key, auth.pin)) { sock.emit('auth-error', 'bad-pin'); sock.disconnect(true); return; }
    sock.join('host'); sock.data.role = 'host';
    sock.emit('host', hostView(state, content, Date.now()));
    sock.on('cmd', (cmd: HostCmd, ack?: Function) => {
      try {
        const now = Date.now();
        const r = hostCommand(state, content, cmd, now);
        if (r.botsWanted) { makeBots(state, content, r.botsWanted, now); }
        if (r.removeBots) cancelBots();
        if (cmd.type === 'removePlayer') for (const sid of socketsByPid.get(cmd.pid) || []) { const s2 = io.sockets.sockets.get(sid); s2?.emit('me', { removed: true }); s2?.disconnect(true); }
        if (cmd.type === 'reset') { cancelBots(); socketsByPid.clear(); io.to('players').emit('reset'); }
        afterChange();
        ack?.({ ok: true, rev: state.rev });
      } catch (e: any) { log('cmd error', e); ack?.({ ok: false, error: String(e?.message || e) }); }
    });
    return;
  }
  if (role === 'screen') {
    if (!isKey(auth.key)) { sock.disconnect(true); return; }
    sock.join('screen'); sock.data.role = 'screen';
    sock.emit('screen', screenView(state, content, Date.now()));
    return;
  }
  // player
  sock.data.role = 'player';
  const tok = String(auth.token || '');
  if (tok) {
    const p = Object.values(state.players).find(x => x.token === tok);
    if (p && p.removed) { sock.emit('me', { removed: true }); }
    else if (p) bindPlayer(sock, p.id);
    else sock.emit('need-join');
  } else sock.emit('need-join');
  sock.emit('pub', playerPublicView(state, content));

  let lastAct = 0;
  const limited = () => { const n = Date.now(); if (n - lastAct < 150) return true; lastAct = n; return false; };

  sock.on('join', (msg: any, ack?: Function) => {
    if (typeof ack !== 'function') return;
    if (sock.data.pid) return ack({ ok: true, token: state.players[sock.data.pid]?.token, pid: sock.data.pid });
    if (msg?.room && String(msg.room) !== state.roomCode) return ack({ ok: false, error: 'bad-room' });
    const r = cleanName(msg?.name);
    if (!r.ok) return ack({ ok: false, error: r.error });
    if (activePlayers(state).length >= 600) return ack({ ok: false, error: 'full' });
    const p = addPlayer(state, content, r.name, Date.now());
    if (msg?.lang === 'ar') p.lang = 'ar';
    bindPlayer(sock, p.id); snapDirty = true; answersDirty = true;
    ack({ ok: true, token: p.token, pid: p.id, name: p.name });
  });
  sock.on('answer', (msg: any, ack?: Function) => {
    const pid = sock.data.pid; if (!pid) return ack?.({ ok: false, error: 'not-joined' });
    const err = submitAnswer(state, content, pid, msg, Date.now());
    if (!err) { answersDirty = true; snapDirty = true; dirtyPids.add(pid); }
    ack?.({ ok: !err, error: err });
  });
  sock.on('ask', (msg: any, ack?: Function) => {
    const pid = sock.data.pid; if (!pid || limited()) return ack?.({ ok: false });
    const recent = state.asks.filter(a => a.pid === pid && Date.now() - a.at < 20000).length;
    if (recent >= 2) return ack?.({ ok: false, error: 'slow-down' });
    const t = cleanText(msg?.text, 140); if (!t) return ack?.({ ok: false, error: 'not-allowed' });
    state.asks.push({ id: Math.random().toString(36).slice(2, 9), pid, name: state.players[pid].name, text: t, at: Date.now() });
    if (state.asks.length > 200) state.asks.shift();
    answersDirty = true; snapDirty = true;
    ack?.({ ok: true });
  });
  sock.on('lang', (l: any) => { const pid = sock.data.pid; if (pid && (l === 'en' || l === 'ar')) state.players[pid].lang = l; });
  sock.on('disconnect', () => {
    const pid = sock.data.pid; if (!pid) return;
    const set = socketsByPid.get(pid); set?.delete(sock.id);
    if (!set || set.size === 0) { const p = state.players[pid]; if (p) { p.connected = false; answersDirty = true; } }
  });
});

// ---------------- broadcast loop ----------------
let lastRev = -1;
let lastSceneKey = '';
function afterChange() { snapDirty = true; }
function flush() {
  const now = Date.now();
  if (tick(state, content, now)) snapDirty = true;
  autoAdvance(now);
  const revChanged = state.rev !== lastRev;
  if (revChanged) {
    lastRev = state.rev;
    io.to('players').emit('pub', playerPublicView(state, content));
    for (const pid of socketsByPid.keys()) dirtyPids.add(pid);
    const key = `${state.sceneIdx}:${state.phase}:${state.timer.startedAt}`;
    if (key !== lastSceneKey) {
      lastSceneKey = key;
      const sc = sceneOf(state, content);
      if (state.phase === 'answering' && isAnswerScene(sc)) scheduleBots(state, content, (pid, payload) => {
        const err = submitAnswer(state, content, pid, payload, Date.now());
        if (!err) { answersDirty = true; snapDirty = true; }
      });
    }
  }
  if (revChanged || answersDirty) {
    answersDirty = false;
    if (io.sockets.adapter.rooms.get('screen')?.size) io.to('screen').emit('screen', screenView(state, content, now));
    if (io.sockets.adapter.rooms.get('host')?.size) io.to('host').emit('host', hostView(state, content, now));
  }
  if (dirtyPids.size) {
    for (const pid of dirtyPids) {
      const set = socketsByPid.get(pid); if (!set?.size) continue;
      const v = playerPrivateView(state, content, pid);
      for (const sid of set) io.sockets.sockets.get(sid)?.emit('me', v);
    }
    dirtyPids.clear();
  }
}
let closedAt = 0;
function autoAdvance(now: number) {
  if (!state.settings.autoAdvance) { closedAt = 0; return; }
  const sc = sceneOf(state, content);
  if (state.phase === 'closed' && isAnswerScene(sc)) {
    if (!closedAt) closedAt = now;
    else if (now - closedAt > 2500) { hostCommand(state, content, { type: 'next' }, now); closedAt = 0; snapDirty = true; }
  } else closedAt = 0;
}
setInterval(flush, 80);
let lastSnapErr = 0;
setInterval(() => { try { writeSnapshot(); } catch (e: any) { if (Date.now() - lastSnapErr > 60000) { lastSnapErr = Date.now(); log('snapshot failed (data dir not writable?)', e?.code || e); } } }, SNAPSHOT_MS);
const shutdown = () => { try { snapDirty = true; writeSnapshot(); } catch { } process.exit(0); };
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);

server.listen(PORT, () => {
  log(`Scope Quest on :${PORT}  room ${state.roomCode}`);
  log(`Host link: ${PUBLIC_URL || `http://localhost:${PORT}`}/host?k=${HOST_KEY}  (PIN required)`);
});
