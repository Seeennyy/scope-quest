# 🥖 Scope Quest: the Nile Loaf Carbon Inventory

A live GHG accounting game for a lecture hall (30–150+ people on their own phones, no app, no account). The audience works for **Nile Loaf**, a fictional Cairo bakery chain. The instructor plays the **Chief Auditor**: nothing is official until she stamps it.

**The version in use has three activities** (about 25–30 minutes):
1. **System boundaries.** 9 cards (facilities, suppliers, neighbours…) dragged into **Inside our boundary / Outside, but reported / Not in our report** (ISO 14064-1:2018, 3.4.7–3.4.8, 5.1, 5.2.3; Nile Loaf uses financial control).
2. **Sort the scopes.** 9 emission sources dragged into **Scope 1 / Scope 2 / Scope 3** baskets.
3. **What kind of data is it?** 9 pieces of data, dragged into **Site-specific / Primary / Secondary** baskets (ISO 14064-1:2018, 3.2.2–3.2.4).

After each activity the projector reveals card by card how many people put it in each basket, then a **results summary** shows the % of the room that got every card right. The finale shows the team podium, the top players and three takeaways (one per activity). The full 23-scene game (cold open, ISO categories, calculations, board meeting) is kept in `content/content-full-23-scenes.json`: copy it over `content/content.json` to bring it back.

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
- **Railway** (config in `railway.json`): New Project → Deploy from GitHub repo → pick this repo → Variables: `HOST_KEY`, `HOST_PIN`, `RAILWAY_RUN_UID=0` → right-click the service → Attach volume at **`/app/data`** → Settings → Networking → Generate Domain → add `PUBLIC_URL=https://<that-domain>`. The Dockerfile must not contain a `VOLUME` line, because Railway rejects it.
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
- **Drag-to-basket activities:** cards are dragged with a finger (or tapped, then a basket tapped: same result, and accessible). A card can be moved to another basket until answers are locked. The projector shows live basket counts, then per-card splits (Show split → Confirm), then a results summary with % correct per card and the most common wrong basket. Remote: **⏩ All → summary** confirms every remaining card at once.
- **Finale:** team podium, top individuals, takeaways, and a personal result card on each phone. (The full version adds the story, cold open, polls, word cloud, calculations and a one-page inventory report.)
- **Instructor control:** nothing advances unless pressed. Start/pause timer, +15 s, lock, show split, **Debate moment** (picks one nickname per side when no answer has more than 60%), **Confirm** (stamp + sound), leaderboard, skip, back, jump to any scene, blackout, QR overlay, auto-advance (opt-in), screen language EN/AR, mute.
- **Wisdom cards** with live stats ("41% chose S1. Ask them who controls the van"), name-calling lists, Ask-the-Auditor queue with pin-to-screen, remove player, rehearsal bots, CSV export, stats page.
- **Phones:** one big action per screen, thumb-size targets, vibration, Arabic RTL toggle, built-in calculator, automatic rejoin after lock/reload/signal loss (token in localStorage), late join anytime, profanity-filtered nicknames, answer keys never sent to phones before Confirm.
- **Projector:** huge type, high contrast, illustrated Nile map, countdown + sound, live "87 of 112 answered", auditor stamp, confetti; readable at 1280×720.

## Tests
```bash
npm run build
npm run test:engine     # answer keys, scoring (incl. half points), summary, no answer leaks
npm run test:load       # 250 players play the whole game over WebSockets; latency report
npm run test:restart    # SIGKILL mid-question → restart → session + scores intact
npx tsx tests/offline.ts   # real phone page loses network for 20 s → rejoins with score
npm run test:e2e        # rehearsal mode: instructor + 40 bots to the finale
npx tsx tests/perf.ts      # phone load time on throttled 4G + 4× CPU slowdown
npx tsx tests/shots.ts both       # real mouse drags on a phone + screenshots (EN + AR, phone + 1080p + 720p)
npx tsx tests/touch.ts            # finger (touch) drag into a basket on an emulated phone
```
Results from the last run are in [TESTING.md](TESTING.md).

## Architecture
`shared/engine.ts` is a pure state machine (scenes, phases, scoring) used by the server **and** by the projector's offline mode. `shared/views.ts` builds what each role may see (phones get no answer keys until confirmed). `server/index.ts` is Express + Socket.IO in one process: it batches broadcasts every 80 ms and snapshots to disk every 2 s. The client is React + Vite with lazy routes, so the phone loads only the play bundle (~103 KB gzipped).
