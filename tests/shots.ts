// Screenshot harness: drives a real game with a phone page, two projector sizes and rehearsal bots.
// Usage: tsx tests/shots.ts [ch1|all] [en|ar|both]
import puppeteer, { Page, Browser } from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, waitHealth, host, sleep, KEY, ROOT } from './util';

const MODE = process.argv[2] || 'ch1';
const LANGS = (process.argv[3] || 'en') === 'both' ? ['en', 'ar'] : [process.argv[3] || 'en'];
const OUT = path.join(ROOT, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 3102;
const BASE = `http://localhost:${PORT}`;

async function clickText(page: Page, text: string, sel = 'button') {
  for (let i = 0; i < 30; i++) {
    const ok = await page.evaluate((t, s) => {
      const el = [...document.querySelectorAll(s)].find(e => (e as HTMLElement).innerText.trim().includes(t)) as HTMLElement | undefined;
      if (el && !(el as HTMLButtonElement).disabled) { el.click(); return true; } return false;
    }, text, sel);
    if (ok) { await sleep(250); return; }
    await sleep(200);
  }
  await page.screenshot({ path: '/tmp/fail.png' }); console.error('BODY', (await page.evaluate(() => document.body.innerText)).slice(0, 400));
  throw new Error(`no clickable "${text}"`);
}

async function run(lang: string, browser: Browser) {
  const data = `/tmp/sq-shots-${lang}-${Date.now()}`;
  const srv = startServer(PORT, data, { BOT_SPAN_MS: '1200', PUBLIC_URL: 'https://ghg.yourdomain.com' });
  await waitHealth(PORT);
  const h = await host(PORT);
  const room = h.last().roomCode;
  await h.cmd({ type: 'lang', v: lang });

  const mk = async (w: number, hgt: number, scale = 1) => { const p = await browser.newPage(); await p.setViewport({ width: w, height: hgt, deviceScaleFactor: scale }); p.on('pageerror', (e: any) => console.error('PAGEERROR', e.message)); await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]); return p; };
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
      if (r !== 'ok') console.error('screenshot timeout', file);
    };
    if (which.includes('screen')) { await snap(s1080, `${lang}-${tag}-1920x1080.png`); await snap(s720, `${lang}-${tag}-1280x720.png`); }
    if (which.includes('phone')) await snap(phone, `${lang}-${tag}-phone.png`);
    console.log('shot', lang, tag);
  };
  const idx = (id: string) => h.last().scene && fetch(`${BASE}/api/content`).then(r => r.json()).then((c: any) => c.scenes.findIndex((s: any) => s.id === id));
  const goto = async (id: string) => { await h.cmd({ type: 'goto', idx: await idx(id) }); await sleep(300); };
  const next = async (k = 1) => { for (let i = 0; i < k; i++) { await h.cmd({ type: 'next' }); await sleep(120); } };

  // ---- join
  await phone.goto(`${BASE}/?r=${room}`, { waitUntil: 'load' });
  await phone.waitForSelector('input', { timeout: 10000 }); await phone.click('input', { count: 3 }); await phone.keyboard.press('Backspace'); await phone.type('input', 'Seeny');
  await shot('join', ['phone'], 300);
  await h.cmd({ type: 'addBots', n: 46 });
  await clickText(phone, lang === 'ar' ? 'يلا' : "Let's go");
  await shot('lobby');

  // ---- cold open
  await next(); await shot('coldopen-intro', ['screen'], 400);
  await next(); await sleep(300);
  await clickText(phone, lang === 'ar' ? '3.1' : '3.1 t');
  await sleep(1500); await shot('coldopen-answering');
  await next(2); await shot('coldopen-split', ['screen']);
  await next(); await shot('coldopen-confirmed', ['screen', 'phone'], 2600);

  // ---- story
  await next(); await next(3); await shot('story-hired', ['screen', 'phone'], 2500);

  // ---- chapter 1, batch 1
  await goto('ch1_a');
  await next(); await sleep(400);
  await shot('ch1-answering');
  const S = lang === 'ar' ? ['نطاق 1', 'نطاق 2', 'نطاق 3'] : ['Scope 1', 'Scope 2', 'Scope 3'];
  await clickText(phone, S[0]); // oven gas
  await clickText(phone, S[0]); // own diesel vans
  await shot('ch1-card3', ['phone'], 200);
  await clickText(phone, S[1]); // grid
  await clickText(phone, S[0]); // EV vans (wrong on purpose)
  await sleep(1800);
  await shot('ch1-locked', ['phone', 'screen'], 200);
  await next(); // lock
  await shot('ch1-closed', ['screen'], 400);
  await next(); await shot('ch1-split-item1', ['screen']);
  await s1080.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]); await s1080.bringToFront();
  await h.cmd({ type: 'confirm' }); await sleep(1100);
  await s1080.screenshot({ path: path.join(OUT, `${lang}-00-stamp-landing-1920x1080.png`) });
  await s1080.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await shot('ch1-confirmed-item1', ['screen', 'phone'], 1300);
  await next(); await next(); await next(); await next(); // item2 split → confirm → item3 split → confirm
  await next(); await h.cmd({ type: 'debate' }); await shot('ch1-debate-item4', ['screen'], 700);
  await h.cmd({ type: 'confirm' }); await shot('ch1-confirmed-item4', ['screen', 'phone'], 1300);

  if (MODE === 'all') {
    // batch 2 with a Scope 3 category pick on the phone
    await goto('ch1_b'); await next(); await sleep(400);
    await clickText(phone, S[0]); await clickText(phone, S[2]);
    await shot('ch1b-category-picker', ['phone'], 200);
    await clickText(phone, '8 '); await clickText(phone, S[0]); await clickText(phone, S[2]); await clickText(phone, '4 ');
    await sleep(1500); await next(); await next(); await h.cmd({ type: 'confirm' }); await next(); await next();
    await shot('ch1b-leased-split', ['screen']);
    await h.cmd({ type: 'confirm' }); await shot('ch1b-leased-confirmed', ['screen', 'phone'], 1300);
    // poll + word cloud
    await goto('wordcloud'); await next(); await sleep(300);
    await phone.type('input.word-in', lang === 'ar' ? 'مرعب' : 'overwhelming'); await clickText(phone, lang === 'ar' ? 'ابعت' : 'Send');
    await sleep(1500); await shot('wordcloud-answering', ['phone'], 100); await next(2); await shot('wordcloud', ['screen'], 1000);
    // chapter 2
    await goto('ch2_intro'); await next(2); await shot('ch2-intro', ['screen'], 2200);
    await goto('ch2_iso'); await next(); await sleep(400); await shot('ch2-answering');
    const iso = lang === 'ar' ? ['1 مباشرة', '2 الطاقة', '3 النقل', '4 منتجات', '3 النقل', '3 النقل', '4 منتجات', '5 استخدام'] : ['1 Direct', '2 Imported', '3 Transport', '3 Transport', '4 Products', '3 Transport', '4 Products', '5 Use'];
    for (const t of iso) await clickText(phone, t);
    await sleep(1500); await next(); await next();
    for (let i = 0; i < 7; i++) { await h.cmd({ type: 'confirm' }); await sleep(100); await next(); await sleep(100); }
    await shot('ch2-mapping-partial', ['screen'], 400);
    await h.cmd({ type: 'confirm' }); await shot('ch2-mapping-insight', ['screen', 'phone'], 1300);
    // chapter 3
    await goto('ch3_intro'); await next(2); await shot('ch3-intro', ['screen'], 2200);
    await goto('calc_vans'); await next(); await sleep(400); await shot('calc-vans-answering');
    await phone.click('.calc-keys .ck:nth-child(9)'); // 1
    for (const k of ['8', '0', '0', '0', '×', '2', '.', '6', '6', '1', '5', '5', '÷', '1', '0', '0', '0', '=']) await clickText(phone, k, '.calc-keys .ck');
    await shot('calc-vans-calculator', ['phone'], 200);
    await clickText(phone, 'USE', '.calc-keys .ck'); await clickText(phone, lang === 'ar' ? 'إرسال' : 'Submit');
    await sleep(1500); await next(2); await shot('calc-vans-split', ['screen'], 900);
    await next(); await shot('calc-vans-confirmed', ['screen', 'phone'], 1600);
    await goto('calc_elec'); await next(); await sleep(1500); await next(2); await next(); await sleep(200);
    await goto('calc_fridge'); await next(); await sleep(400); await shot('calc-fridge-answering', ['screen'], 300); await sleep(1300); await next(2); await next(); await shot('calc-fridge-confirmed', ['screen'], 1600);
    await goto('calc_flights'); await next(); await sleep(1500); await next(2); await next();
    await goto('methods_courier'); await next(); await sleep(400); await shot('methods-answering');
    await sleep(1500); await next(2); await shot('methods-split', ['screen'], 900); await next(); await shot('methods-confirmed', ['screen', 'phone'], 2200);
    await goto('inventory'); await shot('inventory', ['screen'], 1200); await next(); await shot('inventory-prediction', ['screen'], 1200);
    // chapter 4
    await goto('board'); await next(); await sleep(400);
    await clickText(phone, lang === 'ar' ? 'إصلاح' : 'Fix refrigerant'); await clickText(phone, lang === 'ar' ? 'الشراكة' : 'Engage the flour');
    await shot('board-answering'); await clickText(phone, lang === 'ar' ? 'ابعت خطتي' : 'Send my plan'); await sleep(1500);
    await next(); await next(); await shot('board-plans', ['screen', 'phone'], 900);
    await next(); await shot('board-footprints', ['screen'], 1800);
    await next(); await shot('board-honest', ['screen'], 2200);
    await next(); await shot('board-confirmed', ['screen'], 1500);
    // overlays
    await h.cmd({ type: 'overlay', v: 'leaderboard' }); await shot('leaderboard-overlay', ['screen'], 1200); await h.cmd({ type: 'overlay', v: 'leaderboard' });
    // finale
    await goto('finale'); await shot('finale-podium', ['screen', 'phone'], 2500);
    await next(); await shot('finale-top3', ['screen'], 1200); await next(); await shot('finale-report', ['screen'], 1200); await next(); await shot('finale-takeaways', ['screen'], 2000);
    // host & admin views (phone-size remote)
    const hp = await mk(390, 844, 2);
    await hp.evaluateOnNewDocument(() => { sessionStorage.setItem('sq-pin', '4321'); });
    await goto('ch1_b'); await next(); await sleep(1500); await next(2);
    await hp.goto(`${BASE}/host?k=${KEY}`, { waitUntil: 'load' }); await sleep(800);
    await hp.screenshot({ path: path.join(OUT, `${lang}-90-host-remote.png`), fullPage: true });
    await hp.evaluate(() => (document.querySelectorAll('.h-tabs button')[2] as HTMLElement).click()); await sleep(800);
    await hp.screenshot({ path: path.join(OUT, `${lang}-91-host-stats.png`), fullPage: true });
    const ap = await mk(1440, 900);
    await ap.evaluateOnNewDocument(() => { sessionStorage.setItem('sq-pin', '4321'); });
    await ap.goto(`${BASE}/admin?k=${KEY}`, { waitUntil: 'load' }); await sleep(1500);
    await ap.screenshot({ path: path.join(OUT, `${lang}-92-admin.png`) });
  }
  srv.kill();
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--no-proxy-server', '--disable-dev-shm-usage', '--disable-gpu', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-networking', '--autoplay-policy=no-user-gesture-required', '--font-render-hinting=none'] });
  try { for (const l of LANGS) await run(l, browser); }
  catch (e) { console.error('FAILED', e); process.exitCode = 1; }
  finally { await browser.close(); process.exit(); }
})();
