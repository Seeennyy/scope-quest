// Load test: 250 simulated players play the whole game over real WebSockets.
// Measures (a) host command -> every phone update latency, (b) phone tap -> projector counter latency.
import { io, Socket } from 'socket.io-client';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, waitHealth, sleep, KEY, PIN, ROOT } from './util';

const N = Number(process.env.N || 250);
const PORT = 3200;
const URL = `http://localhost:${PORT}`;
const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/content.json'), 'utf8'));

const pct = (xs: number[], p: number) => { if (!xs.length) return 0; const s = xs.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))]; };

(async () => {
  const dir = `/tmp/sq-load-${Date.now()}`;
  const srv = startServer(PORT, dir);
  const errors: string[] = [];
  srv.stderr!.on('data', d => errors.push('server stderr: ' + String(d).slice(0, 200)));
  await waitHealth(PORT);

  // host + screen
  const host = io(URL, { auth: { role: 'host', key: KEY, pin: PIN }, transports: ['websocket'], forceNew: true });
  let hv: any = null; host.on('host', (x: any) => hv = x);
  const screen = io(URL, { auth: { role: 'screen', key: KEY }, transports: ['websocket'], forceNew: true });
  const screenLog: { t: number; scene: string; answered: number }[] = [];
  screen.on('screen', (x: any) => screenLog.push({ t: Date.now(), scene: x.scene.id, answered: x.counts.answered }));
  await new Promise(r => host.once('host', r));

  // players
  type P = { s: Socket; i: number; recv: { rev: number; t: number }[]; disconnects: number };
  const players: P[] = [];
  const tJoin0 = Date.now();
  const joinTimes: number[] = [];
  for (let b = 0; b < N; b += 25) {
    await Promise.all(Array.from({ length: Math.min(25, N - b) }, (_, k) => new Promise<void>((res, rej) => {
      const i = b + k; const t0 = Date.now();
      const s = io(URL, { auth: { role: 'player', token: '' }, transports: ['websocket'], forceNew: true });
      const p: P = { s, i, recv: [], disconnects: 0 };
      s.on('pub', (x: any) => p.recv.push({ rev: x.rev, t: Date.now() }));
      s.on('disconnect', () => p.disconnects++);
      s.on('connect_error', e => { errors.push(`p${i} connect_error ${e.message}`); rej(e); });
      s.once('need-join', () => s.emit('join', { name: `Load${i}` }, (r: any) => { if (!r?.ok) { errors.push(`join ${i} ${r?.error}`); return rej(new Error('join')); } joinTimes.push(Date.now() - t0); players.push(p); res(); }));
    })));
  }
  const joinWall = Date.now() - tJoin0;
  await sleep(500);
  console.log(`joined ${players.length} players in ${joinWall} ms; host sees ${hv.counts.joined}`);

  const cmdLat: number[] = []; const cmdMax: { scene: string; ms: number }[] = [];
  const tapLat: number[] = [];
  let answers = 0, answerErrors = 0;
  const cmd = async (c: any) => {
    const t0 = Date.now();
    const ack: any = await new Promise(r => host.emit('cmd', c, r));
    if (!ack?.ok) errors.push('cmd failed ' + JSON.stringify(c) + ' ' + ack?.error);
    // wait until every player has received a pub with rev >= ack.rev
    const deadline = Date.now() + 5000;
    let lats: number[] = [];
    while (Date.now() < deadline) {
      lats = players.map(p => { const r = p.recv.find(x => x.rev >= ack.rev && x.t >= t0); return r ? r.t - t0 : -1; });
      if (lats.every(x => x >= 0)) break;
      await sleep(20);
    }
    const missing = lats.filter(x => x < 0).length;
    if (missing) errors.push(`${missing} players never received update for ${JSON.stringify(c)}`);
    const ok = lats.filter(x => x >= 0); cmdLat.push(...ok);
    cmdMax.push({ scene: hv?.scene?.id + ':' + c.type, ms: Math.max(...ok) });
    await sleep(60);
  };
  const emitAnswer = (p: P, payload: any) => new Promise<void>(res => {
    const t = Date.now();
    p.s.emit('answer', payload, (r: any) => { answers++; if (!r?.ok) { answerErrors++; errors.push(`answer err ${r?.error} ${JSON.stringify(payload).slice(0, 60)}`); } res(); void t; });
  });

  const rand = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
  const T0 = Date.now();
  for (let si = 0; si < content.scenes.length; si++) {
    const sc = content.scenes[si];
    if (si > 0) await cmd({ type: 'next' }); // enter scene (from previous scene's last step)
    if (sc.type === 'story') { for (let k = 1; k < sc.lines.length; k++) await cmd({ type: 'next' }); continue; }
    if (sc.type === 'lobby') continue;
    if (sc.type === 'inventory') { await cmd({ type: 'next' }); continue; }
    if (sc.type === 'finale') { for (let k = 0; k < (sc.steps?.length || 4) - 1; k++) await cmd({ type: 'next' }); continue; }
    // answer scenes: start timer
    await cmd({ type: 'start' });
    const before = screenLog.length;
    const emits: number[] = [];
    await Promise.all(players.map(async p => {
      await sleep(Math.random() * 2500);
      let payload: any;
      if (sc.type === 'classify') {
        for (const id of sc.items) {
          const it = content.items.find((x: any) => x.id === id);
          const c = sc.bins ? (Math.random() < 0.7 ? (it.dtype || it.btype || it.scope) : rand(sc.bins.map((b: any) => b.id))) : sc.mode === 'iso' ? String(Math.random() < 0.7 ? it.iso[0] : rand([1, 2, 3, 4, 5, 6])) : (Math.random() < 0.7 ? it.scope : rand(['S1', 'S2', 'S3']));
          if (id === sc.items[sc.items.length - 1]) emits.push(Date.now());
          await emitAnswer(p, { scene: sc.id, item: id, c, cat: c === 'S3' && !sc.drag ? (it.cat || '4') : undefined });
        }
        return;
      }
      if (sc.type === 'vote') payload = { scene: sc.id, c: sc.correct && Math.random() < 0.7 ? sc.correct : (rand(sc.options) as any).id };
      if (sc.type === 'calc') payload = { scene: sc.id, v: content.calcs[sc.calc].answer * (0.9 + Math.random() * 0.2) };
      if (sc.type === 'methods') payload = { scene: sc.id, v: 15 * (0.7 + Math.random() * 0.6) };
      if (sc.type === 'wordcloud') payload = { scene: sc.id, w: rand(['scary', 'huge', 'hidden', 'مرعب', 'important']) };
      if (sc.type === 'board') payload = { scene: sc.id, levers: rand([['ev', 'leak', 'ppa'], ['supplier', 'leak', 'solar'], ['courier_ev', 'shuttle', 'supplier', 'leak']]) };
      emits.push(Date.now());
      await emitAnswer(p, payload);
    }));
    // tap -> projector latency: k-th emit vs first screen update showing answered >= k
    await sleep(400);
    emits.sort((a, b) => a - b);
    const log = screenLog.slice(before).filter(x => x.scene === sc.id);
    emits.forEach((t, k) => { const u = log.find(x => x.answered >= k + 1 && x.t >= t); if (u) tapLat.push(u.t - t); else errors.push(`screen never showed answer #${k + 1} in ${sc.id}`); });
    await cmd({ type: 'close' });
    if (sc.type === 'classify') {
      for (let k = 0; k < sc.items.length; k++) { await cmd({ type: 'next' }); if (k === 0) await cmd({ type: 'debate' }); await cmd({ type: 'confirm' }); }
      if (sc.drag) await cmd({ type: 'next' }); // results summary
    } else if (sc.type === 'board') { await cmd({ type: 'next' }); await cmd({ type: 'next' }); await cmd({ type: 'next' }); await cmd({ type: 'next' }); await cmd({ type: 'confirm' }); }
    else if (sc.type === 'wordcloud') { await cmd({ type: 'next' }); }
    else { await cmd({ type: 'next' }); if (!sc.poll) await cmd({ type: 'confirm' }); }
    console.log(`scene ${sc.id} done (${players.length} answered)`);
  }
  const gameMs = Date.now() - T0;
  await sleep(500);
  const finalLb = hv.leaderboard;
  const disconnects = players.reduce((a, p) => a + p.disconnects, 0);
  const health = await (await fetch(`${URL}/api/health`)).json();
  const stats = await (await fetch(`${URL}/api/stats?k=${KEY}&pin=${PIN}`)).json();
  const csv = await (await fetch(`${URL}/api/export.csv?k=${KEY}&pin=${PIN}`)).text();
  const mem = srv.pid ? fs.readFileSync(`/proc/${srv.pid}/status`, 'utf8').match(/VmRSS:\s+(\d+)/)?.[1] : '?';

  const report = {
    players: players.length, joinWallMs: joinWall, joinP95: pct(joinTimes, 95),
    hostCmdToAllPhones: { n: cmdLat.length, p50: pct(cmdLat, 50), p95: pct(cmdLat, 95), p99: pct(cmdLat, 99), max: Math.max(...cmdLat) },
    tapToProjector: { n: tapLat.length, p50: pct(tapLat, 50), p95: pct(tapLat, 95), p99: pct(tapLat, 99), max: Math.max(...tapLat) },
    answers, answerErrors, disconnects, errors: errors.length, gameMs, serverRssMB: Math.round(Number(mem) / 1024),
    finalScene: health.scene, topTeam: finalLb?.teams?.[0], csvRows: csv.trim().split('\n').length - 1, statsRows: stats.rows.length,
    slowestCommands: cmdMax.sort((a, b) => b.ms - a.ms).slice(0, 5),
  };
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) console.log('ERRORS:', errors.slice(0, 20));
  const pass = errors.length === 0 && report.hostCmdToAllPhones.max < 1000 && report.tapToProjector.max < 1000 && players.length === N && health.scene === 'finale';
  console.log(pass ? 'LOAD TEST PASS' : 'LOAD TEST FAIL');
  fs.writeFileSync(path.join(ROOT, 'tests', 'load-report.json'), JSON.stringify({ at: new Date().toISOString(), pass, ...report, errorSamples: errors.slice(0, 20) }, null, 2));
  for (const p of players) p.s.close(); host.close(); screen.close(); srv.kill();
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
