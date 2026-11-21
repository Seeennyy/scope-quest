// Screenshot + real-drag harness for the 2-activity game: a phone that drags cards with the mouse,
// two projector sizes, the host remote, and rehearsal bots.
// Usage: tsx tests/shots.ts [en|ar|both]
import puppeteer, { Page, Browser } from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, waitHealth, host, sleep, KEY, ROOT } from './util';

const LANGS = (process.argv[2] || 'en') === 'both' ? ['en', 'ar'] : [process.argv[2] || 'en'];
const OUT = path.join(ROOT, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 3102;
const BASE = `http://localhost:${PORT}`;
const content = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/content.json'), 'utf8'));
const itemOf = (id: string) => content.items.find((i: any) => i.id === id);
const errors: string[] = [];

async function clickText(page: Page, text: string, sel = 'button') {
  for (let i = 0; i < 30; i++) {
    const ok = await page.evaluate((t, s) => {
      const el = [...document.querySelectorAll(s)].find(e => (e as HTMLElement).innerText.trim().includes(t)) as HTMLElement | undefined;
      if (el && !(el as HTMLButtonElement).disabled) { el.click(); return true; } return false;
    }, text, sel);
    if (ok) { await sleep(250); return; }
    await sleep(200);
  }
  throw new Error(`no clickable "${text}"`);
}

// Drag the current card onto a basket with real pointer events. Optionally pause mid-air for a screenshot.
async function dragTo(phone: Page, binId: string, mid?: () => Promise<void>) {
  await phone.bringToFront();
  const card = await phone.waitForSelector('.drag-card', { timeout: 5000 });
  const cb = (await card!.boundingBox())!;
  const bins = await phone.$$('.basket');
  const ids = await phone.$$eval('.basket', els => els.map(e => e.getAttribute('aria-label')));
  const sc = content.scenes.find((s: any) => s.bins?.some((b: any) => b.id === binId));
  const b = sc.bins.findIndex((x: any) => x.id === binId);
  void ids;
  const bb = (await bins[b].boundingBox())!;
  const x0 = cb.x + cb.width / 2, y0 = cb.y + cb.height / 2, x1 = bb.x + bb.width / 2, y1 = bb.y + bb.height / 2;
  await phone.mouse.move(x0, y0); await phone.mouse.down();
  for (let i = 1; i <= 12; i++) { await phone.mouse.move(x0 + (x1 - x0) * i / 12, y0 + (y1 - y0) * i / 12); await sleep(16); }
  if (mid) await mid();
  await phone.mouse.up(); await sleep(350);
}

async function run(lang: string, browser: Browser) {
  const data = `/tmp/sq-shots-${lang}-${Date.now()}`;
  const srv = startServer(PORT, data, { BOT_SPAN_MS: '1500', PUBLIC_URL: 'https://scope-quest-production.up.railway.app' });
  srv.stderr!.on('data', d => errors.push(String(d)));
  await waitHealth(PORT);
  const h = await host(PORT);
  const room = h.last().roomCode;
  await h.cmd({ type: 'lang', v: lang });

  const mk = async (w: number, hgt: number, scale = 1) => { const p = await browser.newPage(); await p.setViewport({ width: w, height: hgt, deviceScaleFactor: scale }); p.on('pageerror', (e: any) => errors.push('PAGEERROR ' + e.message)); await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); return p; };
  const s1080 = await mk(1920, 1080); const s720 = await mk(1280, 720); const phone = await mk(390, 844, 2);
  await phone.evaluateOnNewDocument((l: string) => { localStorage.setItem('sq-lang', l); }, lang);
  for (const s of [s1080, s720]) { await s.goto(`${BASE}/screen?k=${KEY}`, { waitUntil: 'load' }); await s.waitForSelector('.topbar', { timeout: 10000 }); await s.evaluate(() => (document.querySelector('.screen') as HTMLElement).click()); }

  let n = 0;
  const shot = async (name: string, which: ('screen' | 'phone')[] = ['screen', 'phone'], wait = 900) => {
    await sleep(wait); n++;
    const tag = `${String(n).padStart(2, '0')}-${name}`;
    const snap = async (pg: Page, file: string) => {
      await pg.bringToFront();
      const r = await Promise.race([pg.screenshot({ path: path.join(OUT, file) }).then(() => 'ok'), sleep(15000).then(() => 'TIMEOUT')]);
      if (r !== 'ok') errors.push('screenshot timeout ' + file);
    };
    if (which.includes('screen')) { await snap(s1080, `${lang}-${tag}-1920x1080.png`); await snap(s720, `${lang}-${tag}-1280x720.png`); }
    if (which.includes('phone')) await snap(phone, `${lang}-${tag}-phone.png`);
    console.log('shot', lang, tag);
  };
  const next = async (k = 1) => { for (let i = 0; i < k; i++) { await h.cmd({ type: 'next' }); await sleep(120); } };
  const myAnswers = async (sceneId: string) => (await (await fetch(`${BASE}/api/state?k=${KEY}&pin=4321`)).json().catch(() => null))?.answers?.[sceneId];
  void myAnswers;

  // ---- join
  await phone.goto(`${BASE}/?r=${room}`, { waitUntil: 'load' });
  await phone.waitForSelector('input', { timeout: 10000 }); await phone.click('input', { count: 3 }); await phone.keyboard.press('Backspace'); await phone.type('input', 'Seeny');
  await h.cmd({ type: 'addBots', n: 30 });
  await clickText(phone, lang === 'ar' ? 'يلا' : "Let's go");
  await shot('lobby');

  for (const act of content.scenes.filter((s: any) => s.type === 'classify')) {
    const key = (id: string) => itemOf(id).dtype || itemOf(id).btype || itemOf(id).scope;
    await next(); await shot(`${act.id}-intro`, ['screen', 'phone'], 500);
    await h.cmd({ type: 'start' }); await sleep(600);
    await shot(`${act.id}-phone-first-card`, ['phone'], 200);
    // Seeny drags every card: one deliberate mistake (card 2) so the results show a ✗
    for (let i = 0; i < act.items.length; i++) {
      const id = act.items[i];
      const good = key(id);
      const pick = i === 1 ? act.bins.find((b: any) => b.id !== good).id : good;
      if (i === 2) await dragTo(phone, pick, () => shot(`${act.id}-phone-mid-drag`, ['phone'], 100));
      else if (i % 3 === 0) { await phone.evaluate((bi: number) => (document.querySelectorAll('.basket')[bi] as HTMLElement).click(), act.bins.findIndex((b: any) => b.id === pick)); await sleep(300); } // tap fallback
      else await dragTo(phone, pick);
      if (i === 4) await shot(`${act.id}-answering`, ['screen', 'phone'], 400);
    }
    await shot(`${act.id}-phone-all-sorted`, ['phone'], 300);
    // verify the server received all of Seeny's drops
    const hv = h.last();
    if (hv.counts.answered < 1) errors.push(`${act.id}: server shows no complete answers`);
    await h.waitFor(v => v.counts.answered >= 31, 8000).catch(() => errors.push(`${act.id}: only ${h.last().counts.answered}/31 complete`));
    await h.cmd({ type: 'close' });
    await next(); await shot(`${act.id}-split-card1`, ['screen'], 1200);
    await h.cmd({ type: 'confirm' }); await shot(`${act.id}-confirmed-card1`, ['screen', 'phone'], 1600);
    if (act.mode === 'scope') { await h.cmd({ type: 'confirmAll' }); }
    else { for (let k = 1; k < act.items.length; k++) { await next(); await h.cmd({ type: 'confirm' }); } await next(); }
    if (h.last().phase !== 'confirmed') errors.push(`${act.id}: summary phase is ${h.last().phase}`);
    await shot(`${act.id}-summary`, ['screen', 'phone'], 1500);
    const ph = await phone.evaluate(() => document.body.innerText);
    if (!/✅|❌/.test(ph)) errors.push(`${act.id}: phone shows no results`);
    if (act.mode === 'data') {
      const hp = await mk(390, 844, 2);
      await hp.evaluateOnNewDocument(() => { sessionStorage.setItem('sq-pin', '4321'); });
      await h.cmd({ type: 'back' }); await sleep(300);
      await hp.goto(`${BASE}/host?k=${KEY}`, { waitUntil: 'load' }); await sleep(1000);
      await hp.screenshot({ path: path.join(OUT, `${lang}-90-host-remote.png`), fullPage: true });
      await hp.close(); await next(); await sleep(300);
    }
  }
  await next(); await shot('finale-podium', ['screen', 'phone'], 1500);
  await next(); await shot('finale-top3', ['screen'], 1000);
  await next(); await shot('finale-takeaways', ['screen'], 2000);
  srv.kill();
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--no-proxy-server', '--disable-dev-shm-usage', '--disable-gpu', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-networking', '--autoplay-policy=no-user-gesture-required', '--font-render-hinting=none'] });
  try { for (const l of LANGS) await run(l, browser); }
  catch (e) { console.error('FAILED', e); errors.push(String(e)); }
  finally {
    await browser.close();
    if (errors.length) console.log('ERRORS', errors);
    console.log(errors.length ? 'SHOTS FAIL' : 'SHOTS PASS (real drag-and-drop on the phone verified)');
    process.exit(errors.length ? 1 : 0);
  }
})();
