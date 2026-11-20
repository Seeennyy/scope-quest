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
  // cold open: everyone answers, half right
  await h.cmd({ type: 'next' }); await h.cmd({ type: 'start' });
  await Promise.all(ps.map((p, i) => new Promise(r => p.s.emit('answer', { scene: 'coldopen', c: i % 2 ? 'b' : 'a' }, r))));
  await h.cmd({ type: 'close' }); await h.cmd({ type: 'next' }); await h.cmd({ type: 'confirm' });
  // jump to Chapter 1 batch 1, start the timer, 20 of 30 players answer every card
  await h.cmd({ type: 'goto', idx: 5 }); await h.cmd({ type: 'start' });
  for (const p of ps.slice(0, 20)) for (const [item, c] of [['oven_gas', 'S1'], ['own_diesel_vans', 'S1'], ['grid_power', 'S2'], ['own_ev_vans', 'S2']]) await new Promise(r => p.s.emit('answer', { scene: 'ch1_a', item, c }, r));
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
  for (const p of ps.slice(20)) for (const [item, c] of [['oven_gas', 'S1'], ['own_diesel_vans', 'S3'], ['grid_power', 'S2'], ['own_ev_vans', 'S1']]) await new Promise(r => p.s.emit('answer', { scene: 'ch1_a', item, c }, r));
  await sleep(300);
  const afterAns = h2.last().counts.answered;
  await h2.cmd({ type: 'close' }); await h2.cmd({ type: 'next' }); await h2.cmd({ type: 'confirm' });
  await sleep(300);
  const sumConfirmed = ps.reduce((a, p) => a + p.me.score, 0);
  const ok = after.scene.id === 'ch1_a' && after.phase === 'answering' && after.counts.answered === before.counts.answered && sumAfter === sumBefore && samePids && ps.every(p => p.s.connected) && afterAns === 30 && sumConfirmed > sumAfter;
  console.log(`after restart: late players answered -> ${afterAns}/30; confirm item 1 -> total score ${sumConfirmed}`);
  console.log(ok ? 'RESTART TEST PASS' : 'RESTART TEST FAIL');
  srv.kill(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
