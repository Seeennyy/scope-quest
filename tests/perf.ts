// Phone budget: gzipped bytes and time-to-playable on throttled 4G + 4x CPU slowdown (mid-range Android).
import puppeteer from 'puppeteer-core';
import { startServer, waitHealth, host, sleep } from './util';
const PORT = 3205;
(async () => {
  const srv = startServer(PORT, `/tmp/sq-perf-${Date.now()}`);
  await waitHealth(PORT); const h = await host(PORT); const room = h.last().roomCode;
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--no-proxy-server', '--disable-dev-shm-usage'] });
  const results: any[] = [];
  for (const profile of [{ name: 'Regular 4G (4 Mbps, 170 ms RTT)', down: 4e6 / 8, up: 3e6 / 8, lat: 170 }, { name: 'Slow 4G (1.6 Mbps, 150 ms RTT ×1.5)', down: 1.6e6 / 8, up: 0.75e6 / 8, lat: 225 }]) {
    const ctx = await browser.createBrowserContext();
    const pg = await ctx.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    const cdp = await pg.target().createCDPSession();
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: profile.lat, downloadThroughput: profile.down, uploadThroughput: profile.up });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    let bytes = 0; const files: string[] = [];
    cdp.on('Network.loadingFinished', (e: any) => { bytes += e.encodedDataLength; });
    pg.on('response', r => files.push(r.url().replace(/^https?:\/\/[^/]+/, '')));
    const t0 = Date.now();
    await pg.goto(`http://localhost:${PORT}/?r=${room}`);
    await pg.waitForSelector('.join-form input', { timeout: 20000 });
    const tForm = Date.now() - t0;
    await pg.type('.join-form input', 'Perf' + results.length); await pg.click('.btn-primary');
    await pg.waitForSelector('.ph-score', { timeout: 20000 });
    const tJoined = Date.now() - t0;
    results.push({ profile: profile.name, joinFormReadyMs: tForm, joinedMs: tJoined, transferredKB: Math.round(bytes / 1024), requests: files.length });
    await ctx.close();
  }
  console.log(JSON.stringify(results, null, 2));
  const ok = results[0].joinFormReadyMs < 3000;
  console.log(ok ? 'PERF PASS (playable < 3 s on 4G)' : 'PERF FAIL');
  await browser.close(); srv.kill(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
