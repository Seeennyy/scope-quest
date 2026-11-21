// A real phone page loses its network for 20 s, then comes back and must rejoin with its score.
import puppeteer from 'puppeteer-core';
import net from 'node:net';
import path from 'node:path';
import { startServer, waitHealth, host, sleep, ROOT } from './util';

const PORT = 3202;
const PROXY = 3203;
const SILENT = process.env.SILENT === '1'; // silent drop: packets vanish, nothing is reset (like walking out of wifi range) // the phone reaches the server only through this TCP proxy, which we can cut
let cut = false; const conns = new Set<net.Socket>();
net.createServer(c => {
  if (cut) { c.destroy(); return; }
  const u = net.connect(PORT, '127.0.0.1'); conns.add(c); conns.add(u);
  c.on('data', d => { if (!cut) u.write(d); }); u.on('data', d => { if (!cut) c.write(d); });
  const done = () => { c.destroy(); u.destroy(); conns.delete(c); conns.delete(u); };
  c.on('error', done); u.on('error', done); c.on('close', done); u.on('close', done);
}).listen(PROXY);
(async () => {
  const srv = startServer(PORT, `/tmp/sq-offline-${Date.now()}`);
  await waitHealth(PORT);
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--no-proxy-server', '--disable-dev-shm-usage'] });
  let ok = false;
  try {
    const h = await host(PORT);
    const room = h.last().roomCode;
    const pg = await browser.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await pg.goto(`http://localhost:${PROXY}/?r=${room}`); await pg.waitForSelector('input');
    await pg.type('input', 'Offliner'); await pg.click('.btn-primary'); await pg.waitForSelector('.ph-score');
    await h.cmd({ type: 'next' }); await h.cmd({ type: 'start' }); await sleep(400);
    await pg.waitForSelector('.basket'); await pg.evaluate(() => (document.querySelector('.basket') as HTMLElement).click()); // card 1 (oven gas) → Scope 1 basket
    await sleep(300); await h.cmd({ type: 'close' }); await h.cmd({ type: 'next' }); await h.cmd({ type: 'confirm' }); await sleep(500);
    const scoreBefore = await pg.$eval('.ph-score', e => (e as HTMLElement).innerText);
    const tokenBefore = await pg.evaluate(() => localStorage.getItem('sq-token'));
    const pidBefore = h.last().players.find((p: any) => p.name === 'Offliner')?.id;
    console.log('before offline: score', scoreBefore.replace(/\s+/g, ' '), 'pid', pidBefore);

    cut = true; if (!SILENT) for (const c of conns) c.destroy(); // network gone: new connections refused; open sockets die (or go silent)
    const tOff = Date.now();
    console.log('phone OFFLINE for 20 s; meanwhile the host moves on two scenes');
    await h.cmd({ type: 'next' }); await h.cmd({ type: 'next' });
    await sleep(10000);
    const banner = await pg.$('.offline-bar');
    const serverSawDrop = h.last().players.find((p: any) => p.name === 'Offliner')?.connected === false;
    await pg.screenshot({ path: path.join(ROOT, 'screenshots', 'offline-during-phone.png') });
    await sleep(Math.max(0, 20000 - (Date.now() - tOff)));
    if (SILENT) for (const c of conns) c.destroy(); cut = false; // network back
    const tOn = Date.now();
    await pg.waitForFunction(() => !document.querySelector('.offline-bar'), { timeout: 15000 });
    const back = Date.now() - tOn;
    await sleep(800);
    const scoreAfter = await pg.$eval('.ph-score', e => (e as HTMLElement).innerText);
    const tokenAfter = await pg.evaluate(() => localStorage.getItem('sq-token'));
    const me = h.last().players.filter((p: any) => p.name.startsWith('Offliner'));
    const sceneText = await pg.evaluate(() => document.querySelector('.ph-main')?.textContent?.slice(0, 60));
    await pg.screenshot({ path: path.join(ROOT, 'screenshots', 'offline-after-phone.png') });
    console.log(`offline banner shown: ${!!banner}; server marked player disconnected: ${serverSawDrop}`);
    console.log(`back online -> rejoined in ${back} ms; score ${scoreAfter.replace(/\s+/g, ' ')}; same token: ${tokenBefore === tokenAfter}; players named Offliner on server: ${me.length} (pid ${me[0]?.id}, connected ${me[0]?.connected}); phone now shows: "${sceneText}"`);
    ok = (SILENT || !!banner) && scoreAfter === scoreBefore && tokenBefore === tokenAfter && me.length === 1 && me[0].id === pidBefore && me[0].connected && back < 10000;
  } catch (e) { console.error(e); }
  console.log(ok ? `OFFLINE TEST PASS${SILENT ? ' (silent drop)' : ''}` : 'OFFLINE TEST FAIL');
  await browser.close(); srv.kill(); process.exit(ok ? 0 : 1);
})();
