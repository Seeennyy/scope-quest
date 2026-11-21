// Shared types for Scope Quest (server, clients, offline screen engine)
export type Lang = 'en' | 'ar';
export type L10n = { en: string; ar: string };

export interface Item {
  id: string; icon: string; pos: [number, number]; transport: boolean;
  name: L10n; desc: L10n;
  scope?: 'S1' | 'S2' | 'S3'; cat?: string | null; iso?: number[]; isoAlso?: number[];
  reason?: L10n; source?: string; isoReason?: L10n; isoSource?: string;
  wisdom?: Wisdom & { follow?: Record<string, string> };
  // data-type activity (ISO 14064-1 3.2.2–3.2.4): SS site-specific, P primary (not site-specific), S secondary
  dtype?: string; dHalf?: string[]; dReason?: L10n; dSource?: string;
}
export interface Bin { id: string; icon: string; t: L10n; hint: L10n; cls: string }
export interface Wisdom { talk: string; misconception: string; clause: string }
export interface DocLine { k: L10n; v: L10n; hl?: boolean; m?: string }
export interface Doc { kind: string; from: L10n; lines: DocLine[] }
export interface Calc { icon: string; factor: string; answer?: number; unit: string; scope: 'S1' | 'S2' | 'S3'; label: L10n; doc: Doc; formula?: L10n; wisdom?: Wisdom }
export interface MethodOpt { name: L10n; factor: string; answer?: number; formula?: L10n; hint: L10n }
export interface Lever { id: string; icon: string; cost: number; name: L10n; effect: L10n }
export interface Factor { id: string; name: string; value: number; unit: string; source: string; note: string }

export interface Scene {
  id: string; type: 'lobby' | 'story' | 'vote' | 'classify' | 'wordcloud' | 'calc' | 'methods' | 'inventory' | 'board' | 'finale';
  title?: L10n; chapter?: number; time?: number; points?: number; poll?: boolean;
  q?: L10n; options?: { id: string; t: L10n }[]; correct?: string; reveal?: L10n[]; revealSource?: string; source?: string;
  lines?: L10n[]; showConsolidation?: boolean; mode?: 'scope' | 'iso' | 'data'; drag?: boolean; bins?: Bin[]; steps?: ('podium' | 'top' | 'report' | 'takeaways')[]; items?: string[]; ceo?: L10n; insight?: L10n;
  calc?: string; honest?: L10n[]; takeaways?: L10n[]; wisdom?: Wisdom;
}

export interface Content {
  meta: { title: L10n; subtitle: L10n; instructorName: string; company: L10n; inventoryYear: number; ceoName: L10n; consolidation: L10n };
  teams: { id: string; name: L10n; emoji: string; color: string }[];
  sources: Record<string, string>;
  factors: Factor[];
  categories: { ghgp: Record<string, L10n>; iso: Record<string, L10n> };
  items: Item[];
  calcs: Record<string, Calc>;
  methods: { id: string; label: L10n; doc: Doc; options: Record<string, MethodOpt>; inventoryUses: string; wisdom?: Wisdom };
  prefilled: { id: string; scope: 'S1' | 'S2' | 'S3'; label: L10n; value: number; calc: string }[];
  levers: Lever[];
  boardModel: Record<string, number | string>;
  scenes: Scene[];
}

export type Phase = 'intro' | 'answering' | 'closed' | 'reveal' | 'confirmed' | 'show';

export interface Player {
  id: string; token: string; name: string; teamId: string; joinedAt: number; order: number;
  connected: boolean; removed?: boolean; bot?: boolean; lang?: Lang;
}

export interface ItemAns { c: string; cat?: string; at: number }
export interface AnswerRec {
  at: number;
  items?: Record<string, ItemAns>; // classify
  c?: string;                       // vote
  v?: number; m?: string;           // calc / methods
  levers?: string[];                // board
  w?: string;                       // wordcloud
}
export interface ResultRec { pts: number; ok?: boolean; close?: boolean; unitSlip?: boolean; items?: Record<string, { ok: boolean; half?: boolean; catOk?: boolean; pts: number }> }

export interface Ask { id: string; pid: string; name: string; text: string; at: number }

export interface GameState {
  v: 1; sessionId: string; roomCode: string; createdAt: number; updatedAt: number; rev: number;
  sceneIdx: number; phase: Phase; step: number;
  revealItem: number; revealSub: 'split' | 'debate' | 'confirmed' | null;
  timer: { duration: number; endsAt: number | null; remaining: number | null; startedAt: number | null };
  players: Record<string, Player>;
  answers: Record<string, Record<string, AnswerRec>>;
  results: Record<string, Record<string, ResultRec>>;
  confirmedItems: Record<string, string[]>;  // sceneId -> itemIds confirmed (classify) or ['*']
  debate: { itemId: string; sides: { pid: string; name: string; choice: string }[] } | null;
  asks: Ask[]; pinnedAsk: Ask | null;
  teamBonus: Record<string, number>;
  boardPlans: Record<string, string[]>;
  settings: { autoAdvance: boolean; screenOnly: boolean; muted: boolean; lang: Lang; teamCount: number };
  overlay: null | 'leaderboard' | 'blackout' | 'qr';
  orderSeq: number;
  lastCmdAt: number;
}

export type HostCmd =
  | { type: 'next' } | { type: 'back' } | { type: 'goto'; idx: number } | { type: 'skip' }
  | { type: 'start' } | { type: 'pause' } | { type: 'addTime'; s?: number } | { type: 'close' }
  | { type: 'split' } | { type: 'debate' } | { type: 'confirm' } | { type: 'confirmAll' }
  | { type: 'overlay'; v: GameState['overlay'] }
  | { type: 'setting'; key: 'autoAdvance' | 'screenOnly' | 'muted'; v: boolean }
  | { type: 'lang'; v: Lang }
  | { type: 'pinAsk'; id: string } | { type: 'unpinAsk' } | { type: 'dismissAsk'; id: string }
  | { type: 'removePlayer'; pid: string }
  | { type: 'addBots'; n: number } | { type: 'removeBots' }
  | { type: 'reset' };
