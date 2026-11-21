// Rehearsal bots: server-side players that answer with a realistic mix of right & wrong.
import type { Content, GameState } from '../shared/types';
import { addPlayer, sceneOf, itemById, methodOf, binIds } from '../shared/engine';

const NAMES = ['Mona', 'Karim', 'Yara', 'Omar', 'Salma', 'Hany', 'Nada', 'Ziad', 'Farida', 'Tarek', 'Laila', 'Amr', 'Dina', 'Youssef', 'Rana', 'Sherif', 'Hoda', 'Mostafa', 'Aya', 'Khaled', 'Noha', 'Adham', 'Malak', 'Seif', 'Habiba', 'Ali', 'Jana', 'Hassan', 'Mariam', 'Fady'];
const WORDS = ['scary', 'huge', 'hidden', 'messy', 'important', 'complex', 'everywhere', 'invisible', 'مرعب', 'مهم', 'صعب', 'overwhelming', 'curious', 'unfair'];
let timers: NodeJS.Timeout[] = [];

export function makeBots(s: GameState, c: Content, n: number, now: number) {
  const existing = Object.values(s.players).filter(p => p.bot).length;
  for (let i = 0; i < n; i++) {
    const nm = `🤖${NAMES[(existing + i) % NAMES.length]}`;
    addPlayer(s, c, nm, now, { bot: true });
  }
}
export function cancelBots() { for (const t of timers) clearTimeout(t); timers = []; }

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
const chance = (p: number) => Math.random() < p;

export function scheduleBots(s: GameState, c: Content, submit: (pid: string, payload: any) => void) {
  cancelBots();
  const sc = sceneOf(s, c);
  const bots = Object.values(s.players).filter(p => p.bot && !p.removed);
  const span = Number(process.env.BOT_SPAN_MS) || Math.max(4, Math.min(25, (sc.time || 30) * 0.6)) * 1000;
  for (const b of bots) {
    const skill = 0.45 + ((b.order * 37) % 40) / 100; // 0.45–0.85, stable per bot
    const at = (k = 1) => 800 + Math.random() * span * k;
    const later = (fn: () => void, d: number) => timers.push(setTimeout(fn, d));
    if (sc.type === 'classify') {
      sc.items!.forEach((id, i) => later(() => {
        const it = itemById(c, id);
        let choice: string; let cat: string | undefined;
        if (sc.mode === 'data') {
          choice = chance(skill) ? it.dtype! : pick(binIds(sc));
        } else if (sc.mode === 'iso') {
          choice = chance(skill) ? String(it.iso![0]) : pick(['1', '2', '3', '4', '5', '6']);
        } else {
          choice = chance(skill) ? it.scope! : pick(['S1', 'S2', 'S3']);
          if (choice === 'S3' && !sc.drag) cat = chance(skill * 0.8) && it.cat ? it.cat : pick(Object.keys(c.categories.ghgp));
        }
        submit(b.id, { scene: sc.id, item: id, c: choice, cat });
      }, at((i + 1) / sc.items!.length)));
    } else if (sc.type === 'vote') {
      later(() => submit(b.id, { scene: sc.id, c: sc.correct && chance(skill) ? sc.correct : pick(sc.options!).id }), at());
    } else if (sc.type === 'calc' || sc.type === 'methods') {
      const target = sc.type === 'methods' ? c.methods.options[methodOf(b)].answer! : c.calcs[sc.calc!].answer!;
      let v = target * (1 + (Math.random() - 0.5) * 0.06);
      if (!chance(skill)) v = chance(0.25) ? target * 1000 : target * (0.4 + Math.random() * 1.4);
      later(() => submit(b.id, { scene: sc.id, v: Math.round(v * 100) / 100 }), at());
    } else if (sc.type === 'board') {
      const ids = c.levers.map(l => l.id).sort(() => Math.random() - 0.5);
      let budget = Number(c.boardModel.budget); const chosen: string[] = [];
      for (const id of ids) { const cost = c.levers.find(l => l.id === id)!.cost; if (cost <= budget && chance(0.6)) { chosen.push(id); budget -= cost; } }
      later(() => submit(b.id, { scene: sc.id, levers: chosen }), at());
    } else if (sc.type === 'wordcloud') {
      later(() => submit(b.id, { scene: sc.id, w: pick(WORDS) }), at());
    }
  }
}
