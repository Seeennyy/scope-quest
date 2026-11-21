# TESTING.md: evidence for "done means"

Last full run: 21 Nov 2026, on the **3-activity build** (drag-to-basket: system boundaries, scopes, data types). Everything ran locally (server and clients on the same machine, Node 22, headless Chrome), so the latency numbers exclude real network time. On the day, add the hall's wifi/4G round trip (typically 20–150 ms).

| # | Requirement | Result |
|---|---|---|
| 1 | Load test: 250 players complete the whole game, no errors, no update slower than 1 s | **PASS** |
| 2 | Real drag-and-drop on a phone (mouse **and** touch), screenshots at 390×844, 1920×1080, 1280×720, EN + AR | **PASS** (`tests/shots.ts both`, `tests/touch.ts`) |
| 3 | Kill and restart the server mid-activity → session resumes, answers intact | **PASS** |
| 4 | Phone offline 20 s → rejoins with its score | **PASS** (hard drop and silent drop) |
| 5 | Rehearsal mode runs end to end with bots | **PASS** |
| 6 | Engine unit tests | **PASS**: 14/14 |

## 1. Load test (`npm run test:load`)
250 real Socket.IO clients join, then play all three activities (9 cards each) and the finale. The host drives every step: start, lock, split, debate and confirm on every card, then the results summary. A projector socket watches the counters.

| Metric | Result |
|---|---|
| Players joined | 250 in 0.50 s |
| Host command → **every** phone updated (18,000 samples) | p50 14 ms · p95 84 ms · p99 98 ms · **max 105 ms** |
| Phone drop → projector "answered" counter (750 samples) | p50 41 ms · p95 77 ms · **max 83 ms** |
| Card drops submitted / rejected | 6,750 / 0 |
| Disconnects · errors | 0 · 0 |
| Server memory | 113 MB RSS |

## 2. Drag-and-drop on real browser pages
- `tests/shots.ts both`: a 390×844 phone page joins with 30 bots and drags all 27 cards with real pointer events (some by dragging, some by tapping the basket, one deliberate mistake per activity). The test checks the server received every drop (31/31 complete), that the per-card reveal and results summary appear, and that the phone shows ✅/❌ results. 56 screens per language. **PASS** in English and Arabic (RTL).
- `tests/touch.ts`: an emulated touchscreen phone drags the first card with a finger. The basket highlights under the finger, the card lands in it (1/9), and the page doesn't scroll during the drag. **PASS**.

## 3. Restart (`npm run test:restart`)
30 players; Activity 1 timer running with 20/30 players finished. The server was killed with **SIGKILL** and restarted 1.2 s later: same scene (`act1`), phase `answering`, 20/30 still finished, 30/30 phones reconnected automatically as the same players. The other 10 then answered, and Confirm scored normally.

## 4. Offline 20 s (`npx tsx tests/offline.ts`, `SILENT=1 …`)
A real Chrome phone page drops card 1 (our own bakeries) into "Inside our boundary" (confirmed: 120 pts), then loses its network for 20 s through a TCP proxy while the host moves on. Hard drop: "📶 Reconnecting…" bar shown, back 1.3 s after the network returns as the **same player, 120 pts**. Silent drop: back in 0.7 s, same player, 120 pts.

## 5. Rehearsal (`npm run test:e2e`)
Instructor + 40 bots, lobby → all three activities (card-by-card reveal, then results summary) → finale takeaways. Bots answered 40/40 in each. Stats page and CSV export (40 rows) work. Hardest cards in that run: Delta Mills' footprint per tonne (63%), technician's refill log (65%), chilled water (68%).

## 6. Engine tests (`npm run test:engine`)
14/14, including: exactly 5 scenes (lobby, boundaries, act1, act2, finale) with 3 cards per basket; every card has a source and an Arabic reason; data-type scoring (site-specific 100+, "primary" on a site-specific card 50, wrong 0, nothing before Confirm); boundaries scoring (JV under financial control = inside); "All → summary"; back/forward from the summary; no answer keys (`dtype`, `btype`, reasons…) sent to phones. The full 23-scene content is still tested for its own answer keys.

## Not tested here
- Real phones on hall wifi, and the Railway deploy of this build (my workspace can't reach railway.app). Do one test round on the live link before the lecture.
