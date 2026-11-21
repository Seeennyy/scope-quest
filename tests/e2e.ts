// Rehearsal mode end to end: the instructor alone + N server-side bots, through every scene to the finale.
import fs from 'node:fs';
import path from 'node:path';
import { startServer, waitHealth, host, sleep, KEY, PIN, ROOT } from './util';

const PORT = 3204;
const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/content.json'), 'utf8'));
(async () => {
  const srv = startServer(PORT, `/tmp/sq-e2e-${Date.now()}`, { BOT_SPAN_MS: '700' });
  const errs: string[] = []; srv.stderr!.on('data', d => errs.push(String(d)));
  await waitHealth(PORT);
  const h = await host(PORT);
  await h.cmd({ type: 'addBots', n: 40 });
  await sleep(300);
  const log: string[] = [];
  for (let si = 0; si < content.scenes.length; si++) {
    const sc = content.scenes[si];
    if (si > 0) await h.cmd({ type: 'next' });
    if (sc.type === 'lobby') continue;
    if (sc.type === 'story') { for (let k = 1; k < sc.lines.length; k++) await h.cmd({ type: 'next' }); continue; }
    if (sc.type === 'inventory') { await h.cmd({ type: 'next' }); log.push(`${sc.id}: total ${h.last().inventory?.total?.toFixed(1)} t`); continue; }
    if (sc.type === 'finale') { for (let k = 0; k < (sc.steps?.length || 4) - 1; k++) await h.cmd({ type: 'next' }); continue; }
    await h.cmd({ type: 'start' });
    await h.waitFor(v => v.counts.answered >= 40, 8000).catch(() => errs.push(`${sc.id}: bots did not all answer (${h.last().counts.answered})`));
    const answered = h.last().counts.answered;
    await h.cmd({ type: 'close' });
    if (sc.type === 'classify') for (let k = 0; k < sc.items.length; k++) { await h.cmd({ type: 'next' }); if (h.last().focus?.contested) await h.cmd({ type: 'debate' }); await h.cmd({ type: 'confirm' }); }
    if (sc.type === 'classify' && sc.drag) { await h.cmd({ type: 'next' }); const sm = h.last().summary || []; log.push(`${sc.id} summary: ${sm.length} cards, avg ${Math.round(sm.reduce((x: number, r: any) => x + r.pct, 0) / (sm.length || 1))}% correct, phase ${h.last().phase}`); if (h.last().phase !== 'confirmed' || sm.length !== sc.items.length) errs.push(`${sc.id}: no summary`); }
    else if (sc.type === 'board') { for (let k = 0; k < 4; k++) await h.cmd({ type: 'next' }); }
    else if (sc.type === 'wordcloud') await h.cmd({ type: 'next' });
    else { await h.cmd({ type: 'next' }); if (!sc.poll) await h.cmd({ type: 'confirm' }); }
    await sleep(150);
    const lb = h.last().leaderboard;
    log.push(`${sc.id}: ${answered}/40 answered, phase ${h.last().phase}${h.last().revealSub ? '/' + h.last().revealSub : ''}, leader ${lb?.teams?.[0]?.id} ${lb?.teams?.[0]?.score}`);
  }
  const v = h.last();
  const stats = await (await fetch(`http://localhost:${PORT}/api/stats?k=${KEY}&pin=${PIN}`)).json();
  const csv = await (await fetch(`http://localhost:${PORT}/api/export.csv?k=${KEY}&pin=${PIN}`)).text();
  console.log(log.join('\n'));
  console.log(`finale step ${v.step}; teams ${v.leaderboard.teams.map((t: any) => `${t.id}:${t.score}`).join(' ')}`);
  console.log(`top 3: ${v.leaderboard.top.slice(0, 3).map((p: any) => `${p.name} ${p.score}`).join(', ')}`);
  console.log(`hardest 3 questions: ${stats.rows.slice(0, 3).map((r: any) => `${r.label} ${r.correctPct}%`).join(' | ')}`);
  console.log(`CSV rows: ${csv.trim().split('\n').length - 1}`);
  const ok = !errs.length && v.scene.id === 'finale' && v.step === (content.scenes.at(-1).steps?.length || 4) - 1 && v.leaderboard.top[0].score > 0 && csv.trim().split('\n').length === 41;
  if (errs.length) console.log('ERRORS', errs);
  console.log(ok ? 'REHEARSAL TEST PASS' : 'REHEARSAL TEST FAIL');
  srv.kill(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
