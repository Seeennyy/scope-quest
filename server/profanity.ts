// Small, deliberately conservative nickname filter (English, Egyptian Arabic & Franco-Arab).
const WORDS = [
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'whore', 'slut', 'bastard', 'asshole', 'nigger', 'nigga', 'fag', 'rape', 'porn', 'sex', 'nazi', 'hitler', 'penis', 'vagina', 'boob', 'tits',
  'sharmoot', 'sharmota', 'sharmouta', 'metnak', 'mitnak', 'khawal', 'kos', 'koss', 'teez', 'teaz', 'zeb', 'zob', 'a7a', 'ahbal', 'wes5', 'kalb',
  'شرموط', 'شرموطة', 'متناك', 'خول', 'كس', 'طيز', 'زب', 'أحا', 'احا', 'عرص', 'منيك', 'نيك', 'قحبة', 'لبوة', 'وسخ', 'كلب',
];
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '@': 'a', '$': 's', '!': 'i' };

export function normalize(s: string) {
  return s.toLowerCase().replace(/[0-9@$!]/g, ch => LEET[ch] ?? ch).replace(/[^a-z؀-ۿ]/g, '');
}
export function isProfane(text: string) {
  const raw = text.toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '');
  const n = normalize(text);
  return WORDS.some(w => {
    const ww = w.toLowerCase();
    // short words must match a whole token to avoid false positives (e.g. "kos" in "kosheri")
    if (ww.length <= 3) return text.toLowerCase().split(/[^a-z0-9؀-ۿ]+/).some(t => t === ww || normalize(t) === ww);
    return raw.includes(ww) || n.includes(ww);
  });
}
export function cleanName(input: string): { ok: true; name: string } | { ok: false; error: string } {
  const name = String(input || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
  if (name.length < 2) return { ok: false, error: 'too-short' };
  if (isProfane(name)) return { ok: false, error: 'not-allowed' };
  return { ok: true, name };
}
export function cleanText(input: string, max = 140): string | null {
  const t = String(input || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  if (!t || isProfane(t)) return null;
  return t;
}
