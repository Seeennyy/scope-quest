// Touch drag check: a phone with a touchscreen drags the first card into the Scope 1 basket with finger events.
import puppeteer from 'puppeteer-core';
import { startServer, waitHealth, host, sleep } from './util';
const PORT = 3207;
(async () => {
  const srv = startServer(PORT, `/tmp/sq-touch-${Date.now()}`);
  await waitHealth(PORT);
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--no-proxy-server', '--disable-dev-shm-usage'] });
  let ok = false;
  try {
    const h = await host(PORT); const room = h.last().roomCode;
    const pg = await browser.newPage(); await pg.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await pg.goto(`http://localhost:${PORT}/?r=${room}`); await pg.waitForSelector('input');
    await pg.type('input', 'Thumb'); await pg.tap('.btn-primary'); await pg.waitForSelector('.ph-score');
    await h.cmd({ type: 'next' }); await h.cmd({ type: 'start' });
    const card = await pg.waitForSelector('.drag-card'); const cb = (await card!.boundingBox())!;
    const bins = await pg.$$('.basket'); const bb = (await bins[0].boundingBox())!;
    const x0 = cb.x + cb.width / 2, y0 = cb.y + cb.height / 2, x1 = bb.x + bb.width / 2, y1 = bb.y + bb.height / 2;
    const scrollBefore = await pg.evaluate(() => scrollY);
    await pg.touchscreen.touchStart(x0, y0);
    for (let i = 1; i <= 10; i++) { await pg.touchscreen.touchMove(x0 + (x1 - x0) * i / 10, y0 + (y1 - y0) * i / 10); await sleep(20); }
    const over = await pg.evaluate(() => !!document.querySelector('.basket.over'));
    await pg.touchscreen.touchEnd(); await sleep(600);
    const scrollAfter = await pg.evaluate(() => scrollY);
    const progress = await pg.$eval('.drag-progress', e => (e as HTMLElement).innerText);
    const chips = await pg.$$eval('.basket', els => els.map(e => e.querySelectorAll('.bk-chip').length));
    console.log(`basket highlighted under finger: ${over}; progress "${progress}"; chips per basket ${JSON.stringify(chips)}; page scrolled: ${scrollBefore !== scrollAfter}`);
    ok = over && progress.startsWith('1 of') && chips[0] === 1 && scrollBefore === scrollAfter;
  } catch (e) { console.error(e); }
  console.log(ok ? 'TOUCH DRAG TEST PASS' : 'TOUCH DRAG TEST FAIL');
  await browser.close(); srv.kill(); process.exit(ok ? 0 : 1);
})();
