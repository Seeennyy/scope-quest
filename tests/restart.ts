// Kill the server with SIGKILL mid-question, restart it, and check the session resumes with scores intact.
import { startServer, waitHealth, host, player, sleep, P } from './util';

const PORT = 3201;
(async () => {
  const dir = `/tmp/sq-restart-${Date.now()}`;
  let srv = startServer(PORT, dir);
  await waitHealth(PORT);
  const h = await host(PORT);
  const ps: P[] = [];
  for (let i = 0; i < 30; i++) ps.push(await player(PORT, `Restart${i}`));
  // Activity 1: start the timer, 20 of 30 players drop every card (all correct)
  const act = JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname, '../content/content.json'), 'utf8'));
  const sc = act.scenes.find((x: any) => x.id === 'act1');
  const key = (id: string) => act.items.find((i: any) => i.id === id).scope;
  await h.cmd({ type: 'goto', idx: act.scenes.findIndex((x: any) => x.id === 'act1') }); await h.cmd({ type: 'start' });
  for (const p of ps.slice(0, 20)) for (const item of sc.items) await new Promise(r => p.s.emit('answer', { scene: 'act1', item, c: key(item) }, r));
  await sleep(300);
  const before = h.last();
  const scoresBefore = Object.fromEntries(ps.map(p => [p.me.pid, p.me.score]));
  const sumBefore = Object.values(scoresBefore).reduce((a: number, b: any) => a + b, 0);
  console.log(`BEFORE kill: scene=${before.scene.id} phase=${before.phase} answered=${before.counts.answered}/${before.counts.total} timerEndsAt=${before.timer.endsAt} totalScore=${sumBefore}`);
  await sleep(1500); // > SNAPSHOT_MS (1000 in tests)
  srv.kill('SIGKILL');
  const tKill = Date.now();
  console.log('server killed with SIGKILL (no graceful snapshot)');
  await sleep(1000);
  srv = startServer(PORT, dir);
  await waitHealth(PORT);
  const tUp = Date.now();
  // players reconnect automatically with their stored token
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline && !ps.every(p => p.s.connected)) await sleep(100);
  await sleep(800);
  const h2 = await host(PORT);
  await sleep(300);
  const after = h2.last();
  const scoresAfter = Object.fromEntries(ps.map(p => [p.me.pid, p.me.score]));
  const sumAfter = Object.values(scoresAfter).reduce((a: number, b: any) => a + b, 0);
  const samePids = ps.every(p => scoresBefore[p.me.pid] !== undefined);
  console.log(`AFTER restart (${tUp - tKill} ms down): scene=${after.scene.id} phase=${after.phase} answered=${after.counts.answered}/${after.counts.total} reconnected=${ps.filter(p => p.s.connected).length}/30 totalScore=${sumAfter} samePlayers=${samePids}`);
  // the remaining 10 can still answer, and the auditor can confirm
  for (const p of ps.slice(20)) for (const item of sc.items) await new Promise(r => p.s.emit('answer', { scene: 'act1', item, c: 'S3' }, r));
  await sleep(300);
  const afterAns = h2.last().counts.answered;
  await h2.cmd({ type: 'close' }); await h2.cmd({ type: 'next' }); await h2.cmd({ type: 'confirm' });
  await sleep(300);
  const sumConfirmed = ps.reduce((a, p) => a + p.me.score, 0);
  const ok = sumConfirmed > 0 && after.scene.id === 'act1' && after.phase === 'answering' && after.counts.answered === before.counts.answered && sumAfter === sumBefore && samePids && ps.every(p => p.s.connected) && afterAns === 30 && sumConfirmed > sumAfter;
  console.log(`after restart: late players answered -> ${afterAns}/30; confirm item 1 -> total score ${sumConfirmed}`);
  console.log(ok ? 'RESTART TEST PASS' : 'RESTART TEST FAIL');
  srv.kill(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
