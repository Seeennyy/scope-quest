# TESTING.md: evidence for "done means"

Last full run: 21 Nov 2026, on the final build. Everything ran locally (server and clients on the same machine, Node 22, headless Chrome), so the latency numbers below exclude real network time. On the day, add the hall's wifi/4G round trip (typically 20–150 ms).

| # | Requirement | Result |
|---|---|---|
| 1 | Load test: 250 players complete a full game, no errors, no update slower than 1 s | **PASS**: see below |
| 2 | Screenshots of every screen at 390×844, 1920×1080, 1280×720, in English and Arabic | **PASS**: 92 shots per run → 220 PNGs (`npx tsx tests/shots.ts all both`) |
| 3 | Kill and restart the server mid-question → session resumes, scores intact | **PASS** |
| 4 | Phone offline 20 s → rejoins with its score | **PASS** (hard drop and silent drop) |
| 5 | Rehearsal mode runs end to end with bots | **PASS** |
| 6 | Independent accuracy review done, findings fixed | **DONE**: 0 wrong answer keys; 23 citation/wording findings fixed |
| 7–8 | README (one-command deploy, day-of checklist, editing) · run sheet | `README.md`, `RUN_SHEET.md` |
| + | Phone bundle < 300 KB gzipped, playable < 3 s on 4G | **PASS**: ~103 KB JS+CSS gzipped; playable in 1.1 s |
| + | Engine unit tests (answer keys = activity × factor, no answer leaks to phones) | **PASS**: 10/10 |

## 1. Load test (`npm run test:load`)
250 real Socket.IO clients join, then play every scene (classify, ISO, calc, three methods, polls, word cloud, board, finale). The host drives every step: start, close, split, debate and confirm on every card. A projector socket watches the counters.

| Metric | Result |
|---|---|
| Players joined | 250 in 0.38 s (batches of 25) |
| Host command → **every** phone updated (35,000 samples) | p50 12 ms · p95 83 ms · p99 85 ms · **max 94 ms** |
| Phone tap → projector "answered" counter (3,750 samples) | p50 40 ms · p95 77 ms · p99 80 ms · **max 82 ms** |
| Answers submitted / rejected | 8,500 / 0 |
| Disconnects · errors | 0 · 0 |
| Whole game wall time · server memory | 57 s · 123 MB RSS |

Budget was < 1,000 ms per update and < 500 ms tap→screen. The server batches broadcasts every 80 ms, which is where the ~80 ms p95 comes from. Raw output: `tests/load-report.json`.

## 3. Restart (`npm run test:restart`)
30 players; cold open confirmed (scores 750 in total); Batch 1 timer running with 20/30 answered. The server was killed with **SIGKILL** (no graceful snapshot) and restarted 1.2 s later. Result: same scene (`ch1_a`), phase `answering`, 20/30 still answered, 30/30 phones reconnected automatically as the same players, total score still 750. The 10 remaining players then answered, and Confirm scored normally (total 4,330).

## 4. Offline 20 s (`npx tsx tests/offline.ts`, `SILENT=1 …`)
A real Chrome phone page (390×844) joins, answers the cold open (50 pts), then loses its network for 20 s through a TCP proxy. Chrome's own "offline" emulation doesn't cut open WebSockets, so it can't be used for this. While it's offline the host moves on two scenes.
- **Hard drop** (connections reset): the phone shows the "📶 Reconnecting…" bar, and the server marks the player disconnected. 1.2 s after the network returns it's back as the **same player (same id and token), 50 pts**, on the current scene.
- **Silent drop** (packets vanish, nothing is reset): it rejoined 1.6 s after the network returned, same player, 50 pts, on the current scene.

## 5. Rehearsal (`npm run test:e2e`)
Instructor + 40 server-side bots, from the lobby to finale step 4 (takeaways). Bots answered every scene (40/40). Inventory total on screen: 967.6 t. Stats page and CSV export (40 rows) work. Hardest questions in that run: ISO "Staff flights" 60%, "One trip, three methods" 63%.

## Performance (`npx tsx tests/perf.ts`)
Phone page on throttled networks **with a 4× CPU slowdown** (mid-range Android):

| Profile | Join form ready | Joined | Transferred |
|---|---|---|---|
| Regular 4G (4 Mbps, 170 ms RTT) | **1.1 s** | 1.3 s | 159 KB (incl. Arabic + Latin fonts) |
| Slow 4G (1.6 Mbps) | 1.6 s | 1.9 s | 130 KB |

Bundle (gzipped): play JS 76.5 KB + shared React runtime 16.4 KB + CSS 10.9 KB. Projector, host and admin code are lazy chunks that phones never download.

## 6. Independent accuracy review
A separate reviewer that hadn't seen the build reasoning checked every answer key, the scope↔ISO mapping and FACTORS.md against the three PDFs (including the ISO scans as page images).
- **No answer key was wrong.** All arithmetic and every EDGAR number were confirmed exact.
- Fixed:
  - Table 5.7 row citations (the table has 8 rows over slides 6–7: mill truck = row 6, courier = row 7, app delivery = row 8)
  - ISO insight and takeaway #2 softened to "most transport services", consistent with the game's own Category 4 keys
  - leased-vans consolidation rule now cited to the leased-assets guidance as well as Table 5.7
  - "who pays" scoped to outbound deliveries
  - packaging / Cat 5 wording; amortisation note for vans in ISO; EV ISO reasoning (B.4.1 vs B.3.2)
  - spend factor described as a US trucking-industry factor; generator clause B.2.1
  - CO₂e wording; dual-reporting condition; word-cloud "70%" claim replaced by the game's own 57%
  - Arabic category labels 4/9
  - **EV sub-meter changed from 36,000 to 15,000 kWh** so EV and diesel van mileage match (electricity answer 173.7 → **165.7 t**, inventory 975.6 → **967.6 t**)
  - "excl. land use" on the 53.0 Gt figure
- **Still to verify by hand (listed in FACTORS.md):** the original DESNZ/EPA spreadsheets (values cross-checked only on published copies) and the EEHC 0.381 kg CO₂/kWh grid factor.

## Not tested here
- The Docker image build: Docker Hub isn't reachable from my build machine. The production runtime was tested instead: `npm ci --omit=dev` + `node dist/server.cjs` serves everything, and `/host` without the key returns 404.
- A real DigitalOcean deploy and real phones on hall wifi. Use the day-of checklist in the README.
