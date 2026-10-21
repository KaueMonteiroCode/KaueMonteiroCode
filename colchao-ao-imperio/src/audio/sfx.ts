/**
 * Efeitos sonoros sintetizados com WebAudio (sem arquivos externos).
 */
let ac: AudioContext | null = null;
let enabled = true;
let musicOn = false;
let musicTimer: ReturnType<typeof setInterval> | null = null;

export function setSoundEnabled(v: boolean) { enabled = v; }
function ctx(): AudioContext | null {
  if (!enabled && !musicOn) return null;
  if (!ac) {
    try { ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; }
  }
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.06, delay = 0, slide?: number) {
  const a = ctx();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const sfx = {
  click() { if (enabled) tone(660, 0.05, 'square', 0.03); },
  coin() { if (!enabled) return; tone(988, 0.08, 'square', 0.05); tone(1319, 0.18, 'square', 0.05, 0.07); },
  buy() { if (!enabled) return; tone(523, 0.08, 'triangle', 0.08); tone(659, 0.08, 'triangle', 0.08, 0.08); tone(784, 0.16, 'triangle', 0.08, 0.16); },
  place() { if (enabled) tone(220, 0.09, 'triangle', 0.1, 0, 120); },
  error() { if (!enabled) return; tone(180, 0.12, 'sawtooth', 0.05); tone(140, 0.16, 'sawtooth', 0.05, 0.1); },
  achievement() {
    if (!enabled) return;
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.14, 'square', 0.05, i * 0.09));
    tone(1568, 0.4, 'triangle', 0.05, 0.55);
  },
  levelUp() { if (!enabled) return; [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.06, i * 0.07)); },
  step() { if (enabled) tone(90 + Math.random() * 20, 0.03, 'triangle', 0.03); },
  open() { if (enabled) tone(440, 0.06, 'triangle', 0.04, 0, 660); },
  close() { if (enabled) tone(660, 0.06, 'triangle', 0.04, 0, 440); },
};

/** Musiquinha lo-fi procedural bem discreta */
export function setMusic(on: boolean) {
  musicOn = on;
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  if (!on) return;
  const chords = [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]];
  let i = 0;
  const play = () => {
    const a = ctx(); if (!a) return;
    const ch = chords[i % chords.length];
    ch.forEach((f, k) => tone(f / 2, 1.8, 'sine', 0.025, k * 0.02));
    [0, 0.5, 1, 1.5].forEach((d, k) => tone(ch[(k + i) % 3] * 2, 0.25, 'triangle', 0.012, d));
    i++;
  };
  play();
  musicTimer = setInterval(play, 2000);
}
