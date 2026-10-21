/** Projeção isométrica 2:1. 1 tile = 64x32 px na resolução base; 1 unidade de altura = 32 px. */
export const TW = 64;
export const TH = 32;
export const ZS = 32;

export function isoX(x: number, y: number) {
  return (x - y) * (TW / 2);
}
export function isoY(x: number, y: number, z = 0) {
  return (x + y) * (TH / 2) - z * ZS;
}

/** Converte coordenada de tela (base, sem câmera) em tile (fracionário) no plano z. */
export function screenToTile(sx: number, sy: number, z = 0): { x: number; y: number } {
  const a = sx / (TW / 2);
  const b = (sy + z * ZS) / (TH / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/* ---------------- cores ---------------- */

const shadeCache = new Map<string, string>();

function parseColor(c: string): [number, number, number, number] {
  if (c.startsWith('#')) {
    let h = c.slice(1);
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h.slice(0, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(',').map((s) => parseFloat(s));
    return [p[0], p[1], p[2], p[3] ?? 1];
  }
  return [255, 0, 255, 1];
}

/** amt > 0 clareia, amt < 0 escurece (-1..1) */
export function shade(c: string, amt: number): string {
  const key = c + '|' + amt;
  const hit = shadeCache.get(key);
  if (hit) return hit;
  const [r, g, b, a] = parseColor(c);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  const out = a < 1 ? `rgba(${f(r)},${f(g)},${f(b)},${a})` : `rgb(${f(r)},${f(g)},${f(b)})`;
  shadeCache.set(key, out);
  return out;
}

export function withAlpha(c: string, alpha: number) {
  const [r, g, b] = parseColor(c);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function mix(a: string, b: string, t: number) {
  const A = parseColor(a), B = parseColor(b);
  const f = (i: number) => Math.round(A[i] + (B[i] - A[i]) * t);
  return `rgb(${f(0)},${f(1)},${f(2)})`;
}

export function hsl(h: number, s: number, l: number) {
  return `hsl(${((h % 360) + 360) % 360},${s}%,${l}%)`;
}
