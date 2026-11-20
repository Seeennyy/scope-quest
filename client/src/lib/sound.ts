// Tiny WebAudio sound kit (no audio files).
let ctx: AudioContext | null = null;
let muted = false;
let unlocked = false;
export function setMuted(m: boolean) { muted = m; }
function ac() {
  if (!unlocked) return null;
  if (!ctx) { const C = (window as any).AudioContext || (window as any).webkitAudioContext; if (!C) return null; ctx = new C(); }
  if (ctx!.state === 'suspended') ctx!.resume().catch(() => { });
  return ctx;
}
function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, delay = 0, slideTo?: number) {
  const a = ac(); if (!a || muted) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur: number, vol = 0.3, delay = 0) {
  const a = ac(); if (!a || muted) return;
  const len = Math.floor(a.sampleRate * dur); const buf = a.createBuffer(1, len, a.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const s = a.createBufferSource(); s.buffer = buf; const g = a.createGain(); g.gain.value = vol;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
  s.connect(f).connect(g).connect(a.destination); s.start(a.currentTime + delay);
}
export const sfx = {
  unlock() { unlocked = true; ac(); },
  tick() { tone(1200, 0.05, 'square', 0.05); },
  tock() { tone(800, 0.06, 'square', 0.07); },
  join() { tone(660, 0.08, 'triangle', 0.12); tone(990, 0.1, 'triangle', 0.1, 0.06); },
  stamp() { noise(0.25, 0.6); tone(90, 0.3, 'sine', 0.5, 0, 45); },
  right() { tone(523, 0.12, 'triangle', 0.18); tone(659, 0.12, 'triangle', 0.18, 0.1); tone(784, 0.2, 'triangle', 0.2, 0.2); },
  wrong() { tone(300, 0.25, 'sawtooth', 0.1, 0, 180); },
  reveal() { tone(392, 0.1, 'triangle', 0.15); tone(523, 0.18, 'triangle', 0.15, 0.08); },
  buzzer() { tone(160, 0.5, 'sawtooth', 0.15); },
  blip() { tone(1400 + Math.random() * 300, 0.03, 'square', 0.03); },
  fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.18, i * 0.13)); },
  whoosh() { noise(0.4, 0.25); },
};
export function buzz(ms: number | number[] = 30) { try { navigator.vibrate?.(ms as any); } catch { } }
