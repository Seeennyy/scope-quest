import { useEffect, useState } from 'react';
import type { L10n, Lang } from '../../../shared/types';

const UI = {
  join: { en: 'Join the class', ar: 'انضم للحصة' },
  nickname: { en: 'Your nickname', ar: 'اسمك المستعار' },
  roomCode: { en: 'Room code', ar: 'رقم الغرفة' },
  go: { en: 'Join', ar: 'انضم' },
  noAccount: { en: 'No app. No account. No email.', ar: 'من غير تطبيق ولا حساب ولا إيميل.' },
  youreIn: { en: "You're in", ar: 'تم الانضمام' },
  waitStart: { en: 'Watch the main screen. The first activity starts soon.', ar: 'تابع الشاشة الرئيسية. أول نشاط هيبدأ حالاً.' },
  eyesUp: { en: 'Look at the main screen', ar: 'بص على الشاشة الرئيسية' },
  getReady: { en: 'Get ready…', ar: 'استعد…' },
  locked: { en: 'Answer saved. Waiting for the Chief Auditor to confirm.', ar: 'إجابتك اتسجلت. مستنيين كبيرة المدققين تعتمد.' },
  timeUp: { en: "Time's up!", ar: 'الوقت خلص!' },
  correct: { en: 'Correct!', ar: 'صح!' },
  wrong: { en: 'Not quite', ar: 'مش بالظبط' },
  close: { en: 'Close! Within 15%', ar: 'قريب! في حدود 15%' },
  unitSlip: { en: 'Unit slip! That looks like kg, not tonnes', ar: 'غلطة وحدة! ده بالكيلو مش بالطن' },
  bonus: { en: 'Category bonus!', ar: 'بونص الفئة!' },
  dragHint: { en: 'Drag the card into a basket, or tap a basket', ar: 'اسحب الكارت لسلة، أو دوس على السلة' },
  allSorted: { en: 'All cards sorted', ar: 'كل الكروت اترتبت' },
  tapToMove: { en: 'Changed your mind? Tap a card in a basket, then tap its new basket.', ar: 'غيّرت رأيك؟ دوس على كارت في سلة، وبعدين دوس على السلة الجديدة.' },
  halfRight: { en: 'Half right', ar: 'نص صح' },
  yourScore: { en: 'You got', ar: 'جبت' },
  whichCat: { en: 'Bonus: which Scope 3 category?', ar: 'بونص: أنهي فئة في النطاق 3؟' },
  skip: { en: 'Skip', ar: 'تخطي' },
  nextCard: { en: 'Next', ar: 'التالي' },
  submit: { en: 'Submit', ar: 'إرسال' },
  answerIn: { en: 'Answer in tonnes CO₂e', ar: 'الإجابة بالطن مكافئ CO₂' },
  yourMethod: { en: 'Your method', ar: 'طريقتك' },
  budget: { en: 'Budget', ar: 'الميزانية' },
  coins: { en: 'coins', ar: 'عملة' },
  sendPlan: { en: 'Send my plan', ar: 'ابعت خطتي' },
  planSent: { en: 'Plan sent. You can still change it.', ar: 'الخطة اتبعتت. لسه تقدر تغيرها.' },
  askAuditor: { en: 'Ask the Auditor', ar: 'اسأل المدققة' },
  askPh: { en: 'Your question (short)', ar: 'سؤالك (باختصار)' },
  send: { en: 'Send', ar: 'ابعت' },
  sent: { en: 'Sent', ar: 'اتبعت' },
  points: { en: 'pts', ar: 'نقطة' },
  score: { en: 'Score', ar: 'النقاط' },
  answered: { en: 'answered', ar: 'جاوبوا' },
  of: { en: 'of', ar: 'من' },
  scanToJoin: { en: 'Scan to join', ar: 'امسح للانضمام' },
  orGoTo: { en: 'or go to', ar: 'أو ادخل على' },
  players: { en: 'players', ar: 'لاعب' },
  confirmedBy: { en: 'Confirmed by the Chief Auditor', ar: 'تم الاعتماد من كبيرة المدققين' },
  showOfHands: { en: 'Show of hands', ar: 'ارفعوا إيديكم' },
  debate: { en: 'Debate', ar: 'نقاش' },
  defend: { en: 'defend your answer', ar: 'دافع عن إجابتك' },
  removed: { en: 'You were removed by the host.', ar: 'تم إخراجك من اللعبة.' },
  reconnecting: { en: 'Reconnecting…', ar: 'بنرجّع الاتصال…' },
  oneWord: { en: 'One word', ar: 'كلمة واحدة' },
  team: { en: 'Team', ar: 'فريق' },
  leaderboard: { en: 'Leaderboard', ar: 'الترتيب' },
  inventory: { en: 'Carbon Inventory', ar: 'جرد الكربون' },
  total: { en: 'Total', ar: 'الإجمالي' },
  notMeasured: { en: 'Not yet measured: commuting, generator, packaging, other Scope 3 categories', ar: 'لسه ما اتقاسش: التنقل، المولد، التغليف، باقي فئات النطاق 3' },
  locationBased: { en: 'Location-based', ar: 'حسب الموقع' },
  marketBased: { en: 'Market-based', ar: 'حسب السوق' },
  before: { en: 'Before', ar: 'قبل' },
  after: { en: 'After', ar: 'بعد' },
  cut: { en: 'cut', ar: 'تخفيض' },
  takeaways: { en: 'Three things to remember', ar: 'تلات حاجات افتكرهم' },
  topPlayers: { en: 'Top individuals', ar: 'أفضل اللاعبين' },
  classified: { en: 'classified', ar: 'صنّفت صح' },
  screenshot: { en: 'Take a screenshot to keep your result.', ar: 'خد سكرين شوت عشان تحتفظ بنتيجتك.' },
  room: { en: 'Room', ar: 'الغرفة' },
  source: { en: 'Source', ar: 'المصدر' },
  prediction: { en: 'Your prediction', ar: 'توقعكم' },
  reality: { en: 'Reality', ar: 'الحقيقة' },
  waitingPlan: { en: 'Team plans', ar: 'خطط الفرق' },
  card: { en: 'card', ar: 'بطاقة' },
  awaiting: { en: 'Awaiting confirmation', ar: 'في انتظار الاعتماد' },
  yourAnswer: { en: 'Your answer', ar: 'إجابتك' },
  correctAnswer: { en: 'Correct', ar: 'الصح' },
} satisfies Record<string, L10n>;
export type UIKey = keyof typeof UI;

let current: Lang = (typeof localStorage !== 'undefined' && (localStorage.getItem('sq-lang') as Lang)) || 'en';
const subs = new Set<(l: Lang) => void>();
export function getLang() { return current; }
export function setLang(l: Lang) {
  current = l; try { localStorage.setItem('sq-lang', l); } catch { }
  document.documentElement.lang = l; document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  subs.forEach(f => f(l));
}
export function useLang(): [Lang, (l: Lang) => void] {
  const [l, set] = useState(current);
  useEffect(() => { subs.add(set); return () => { subs.delete(set); }; }, []);
  return [l, setLang];
}
export const tr = (x: L10n | undefined, l: Lang) => (x ? (x[l] || x.en) : '');
export const ui = (k: UIKey, l: Lang) => UI[k][l];
export const num = (n: number, d = 1) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
if (typeof document !== 'undefined') { document.documentElement.lang = current; document.documentElement.dir = current === 'ar' ? 'rtl' : 'ltr'; }
