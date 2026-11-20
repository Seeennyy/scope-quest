# 🥖 Scope Quest: the Nile Loaf Carbon Inventory

A live, story-driven GHG accounting game for a lecture hall (30–150+ people on their own phones, no app, no account). The audience becomes the sustainability team of **Nile Loaf**, a fictional Cairo bakery chain, and builds its first carbon inventory: classify sources into Scopes 1/2/3, translate them into ISO 14064-1's six categories, calculate CO₂e from realistic documents, compare three transport methods, and decide reduction levers at the board meeting. The instructor plays the **Chief Auditor**: nothing is official until she stamps it.

| View | URL | Who |
|---|---|---|
| Phone | `https://YOUR-DOMAIN/` (QR on screen) | audience |
| Projector | `/screen?k=HOST_KEY` | laptop on the projector |
| Remote | `/host?k=HOST_KEY` + PIN | instructor's phone |
| Content editor | `/admin?k=HOST_KEY` + PIN | instructor |
| Stats | `/host?k=HOST_KEY&tab=stats` | after the lecture |

Docs: **[RUN_SHEET.md](RUN_SHEET.md)** (45-min script) · **[FACTORS.md](FACTORS.md)** (every number, source and judgment call to sign off) · [TESTING.md](TESTING.md) (test evidence).

---

## Deploy (one command)

On a fresh Ubuntu DigitalOcean droplet, with the domain's DNS **A record** pointing at the droplet:

```bash
git clone https://github.com/<you>/scope-quest.git /opt/scope-quest && cd /opt/scope-quest
./deploy.sh          # first run creates .env with a random HOST_KEY and stops
nano .env            # set DOMAIN, PUBLIC_URL, HOST_PIN
./deploy.sh          # builds, starts app + Caddy (automatic HTTPS), prints your host link
```

Or from your laptop, if you have SSH access to the droplet: `./deploy.sh root@YOUR_DROPLET_IP` (it rsyncs the repo, copies your local `.env` if the server has none, and runs the same thing remotely).

What runs: `docker compose` with **app** (Node 22: Express + Socket.IO, also serves the built React client) and **caddy** (TLS via Let's Encrypt). Game state is snapshotted every 2 s to `./data/snapshot.json`, so a restart resumes the session with scores intact. Edited content is saved to `./data/content.json`.

Update: `git pull && ./deploy.sh`. Logs: `docker compose logs -f app`. New session: Remote → Room tab → ♻️ Reset game (or stop the app and delete `data/snapshot.json`).

### Fallback hosts (if the droplet is unavailable)
- **Render**: New → Web Service → this repo → Runtime *Docker* (uses the Dockerfile) → add env vars `HOST_KEY`, `HOST_PIN`, `PUBLIC_URL` → add a **Disk** mounted at `/app/data` (otherwise a restart loses the snapshot). Free instances sleep, so use a paid instance on lecture day.
- **Railway**: New project → Deploy from GitHub → it detects the Dockerfile → add the same env vars → add a **Volume** at `/app/data` → Settings → Networking → generate domain.
- Both terminate HTTPS for you, so Caddy isn't needed. WebSockets work on both.

### Run locally
```bash
npm install
npm run build && HOST_KEY=dev HOST_PIN=1234 npm start     # http://localhost:3000
# projector: http://localhost:3000/screen?k=dev   remote: http://localhost:3000/host?k=dev (PIN 1234)
```
Phones on the same wifi can join via `http://<laptop-ip>:3000`.

---

## Lecture-day checklist
- [ ] **Day before:** rehearse once alone: Remote → Room → 🤖 *Add 40 bots*, then click through the whole game. Remove bots and ♻️ Reset afterwards.
- [ ] **Day before:** sign off [FACTORS.md](FACTORS.md) and set your name in `/admin` → Meta → `instructorName` (it appears on the stamp).
- [ ] **In the hall, 15 min early:** test the hall wifi from your own phone (open the audience URL and join as "test", then remove that player from the Room tab).
- [ ] Open the **host link** on your phone early and enter the PIN; open the **projector screen** from the Room tab; click once for sound; press **F** for fullscreen.
- [ ] Bring a **backup 4G hotspot** for the projector laptop. If the audience wifi dies, toggle *Screen-only* on the remote (show of hands). If the laptop loses the server too, press **Shift+L** on the projector to keep running the story locally.
- [ ] After: Room tab → ⬇️ Export CSV (nicknames only); Stats tab shows the hardest questions first.

## How to edit the content
Everything the audience sees or hears, plus every source, factor, answer key and talking point, lives in **one file: `content/content.json`** (English + Arabic side by side).

- **Easiest:** `/admin?k=HOST_KEY` → pick a section (Meta, Scenes & story lines, Emission sources, Evidence files, Factors…) → edit → **Save**. Changes go live immediately for everyone, no redeploy. The right-hand preview shows the projector view of any scene with your unsaved draft. *Restore defaults* goes back to the shipped file, and every save keeps a backup in `data/`.
- **In the repo:** edit `content/content.json` and redeploy. (A file saved through /admin in `data/content.json` takes precedence; *Restore defaults* removes it.)
- The server validates content before saving: every scene must reference existing items, calc answers must be > 0, items need English and Arabic names, and so on.
- If you change a factor, also change the matching calc `answer` and `formula` (the wisdom card shows them to you). `npm run test:engine` re-checks that every answer equals activity × factor.

## Features
- **Story:** CEO "Madame Nour" narrates (typewriter + sound). Cold open uses real EDGAR 2024 Egypt data. Four chapters, pulse polls, a word cloud, and a finale with podium, top individuals, a one-page inventory report, three takeaways and a personal result card on each phone.
- **Instructor control:** nothing advances unless pressed. Start/pause timer, +15 s, lock, show split, **Debate moment** (picks one nickname per side when no answer has more than 60%), **Confirm** (stamp + sound), leaderboard, skip, back, jump to any scene, blackout, QR overlay, auto-advance (opt-in), screen language EN/AR, mute.
- **Wisdom cards** with live stats ("41% chose S1. Ask them who controls the van"), name-calling lists, Ask-the-Auditor queue with pin-to-screen, remove player, rehearsal bots, CSV export, stats page.
- **Phones:** one big action per screen, thumb-size targets, vibration, Arabic RTL toggle, built-in calculator, automatic rejoin after lock/reload/signal loss (token in localStorage), late join anytime, profanity-filtered nicknames, answer keys never sent to phones before Confirm.
- **Projector:** huge type, high contrast, illustrated Nile map, countdown + sound, live "87 of 112 answered", auditor stamp, confetti; readable at 1280×720.

## Tests
```bash
npm run build
npm run test:engine     # answer keys = activity × factor, scoring, board maths, no answer leaks
npm run test:load       # 250 players play the full game over WebSockets; latency report
npm run test:restart    # SIGKILL mid-question → restart → session + scores intact
npx tsx tests/offline.ts   # real phone page loses network for 20 s → rejoins with score
npm run test:e2e        # rehearsal mode: instructor + 40 bots to the finale
npx tsx tests/perf.ts      # phone load time on throttled 4G + 4× CPU slowdown
npx tsx tests/shots.ts all both   # screenshots of every screen (EN + AR, phone + 1080p + 720p)
```
Results from the last run are in [TESTING.md](TESTING.md).

## Architecture
`shared/engine.ts` is a pure state machine (scenes, phases, scoring) used by the server **and** by the projector's offline mode. `shared/views.ts` builds what each role may see (phones get no answer keys until confirmed). `server/index.ts` is Express + Socket.IO in one process: it batches broadcasts every 80 ms and snapshots to disk every 2 s. The client is React + Vite with lazy routes, so the phone loads only the play bundle (~103 KB gzipped).
