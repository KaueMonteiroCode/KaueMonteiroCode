import { isoX, isoY, shade, TW, TH, ZS } from './iso';

/**
 * Primitivas de modelo. Um móvel é uma lista de primitivas em coordenadas locais do seu
 * "footprint" (w x d tiles, rotação 0). As faces podem receber pinturas (telas, gavetas,
 * ventoinhas RGB...) desenhadas num espaço 2D da própria face: 1 unidade = 32 px de face.
 */
export type Paint = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void;

export interface BoxPrim {
  t: 'box';
  x: number; y: number; z: number;
  w: number; d: number; h: number;
  c: string;
  top?: Paint; px?: Paint; py?: Paint; mx?: Paint; my?: Paint;
  /** cores manuais por face */
  ct?: string; cl?: string; cr?: string;
  outline?: boolean; // padrão: true
  alpha?: number;
  glass?: boolean;
}

export interface SpritePrim {
  t: 'spr';
  x: number; y: number; z: number;
  /** desenha em coordenadas de tela relativas ao ponto (x,y,z); recebe a rotação para espelhar */
  draw: (ctx: CanvasRenderingContext2D, t: number, rot: number) => void;
  /** caixa aproximada para ordenação (tamanho em tiles) */
  r?: number; h?: number;
}

export type Prim = BoxPrim | SpritePrim;

export const FS = 32; // px de face por unidade

/* --------- helpers de construção --------- */

export function box(
  x: number, y: number, z: number, w: number, d: number, h: number, c: string,
  extra: Partial<BoxPrim> = {},
): BoxPrim {
  return { t: 'box', x, y, z, w, d, h, c, ...extra };
}

export function spr(x: number, y: number, z: number, draw: SpritePrim['draw'], r = 0.3, h = 1): SpritePrim {
  return { t: 'spr', x, y, z, draw, r, h };
}

/* --------- rotação --------- */

type FaceKey = 'px' | 'py' | 'mx' | 'my';
const ROT1: Record<FaceKey, FaceKey> = { px: 'py', py: 'mx', mx: 'my', my: 'px' };

export interface RotBox extends BoxPrim {
  /** para cada face mundial visível, qual face local foi parar lá */
  faceMap: Partial<Record<FaceKey, FaceKey>>;
  rot: number;
  // dimensões locais originais (para pintar faces com as medidas certas)
  lw: number; ld: number;
}

/** Gira um box local (footprint W x D) r vezes 90°. Devolve box em coordenadas de mundo-local. */
export function rotateBox(b: BoxPrim, W: number, D: number, r: number): RotBox {
  let { x, y, w, d } = b;
  let FW = W, FD = D;
  // world face <- local face
  let map: Record<FaceKey, FaceKey> = { px: 'px', py: 'py', mx: 'mx', my: 'my' };
  for (let i = 0; i < (r & 3); i++) {
    const nx = FD - (y + d);
    const ny = x;
    x = nx; y = ny;
    [w, d] = [d, w];
    [FW, FD] = [FD, FW];
    const nm = {} as Record<FaceKey, FaceKey>;
    for (const k of Object.keys(map) as FaceKey[]) nm[ROT1[k]] = map[k];
    map = nm;
  }
  return { ...b, x, y, w, d, faceMap: map, rot: r & 3, lw: b.w, ld: b.d };
}

export function rotatePoint(px: number, py: number, W: number, D: number, r: number) {
  let x = px, y = py, FW = W, FD = D;
  for (let i = 0; i < (r & 3); i++) {
    const nx = FD - y;
    const ny = x;
    x = nx; y = ny;
    [FW, FD] = [FD, FW];
  }
  return { x, y };
}

export function rotFootprint(w: number, d: number, r: number) {
  return r & 1 ? { w: d, d: w } : { w, d };
}

/* --------- desenho --------- */

const OUTLINE = 'rgba(20,14,28,0.85)';

function faceTransform(
  ctx: CanvasRenderingContext2D,
  ox: number, oy: number,
  // origem em mundo (x,y,z) e eixos u/v como vetores de mundo por unidade
  o: [number, number, number], u: [number, number, number], v: [number, number, number],
) {
  const sx = (p: [number, number, number]) => isoX(p[0], p[1]);
  const sy = (p: [number, number, number]) => isoY(p[0], p[1], p[2]);
  const O: [number, number] = [ox + sx(o), oy + sy(o)];
  const ux = (u[0] - u[1]) * (TW / 2) / FS;
  const uy = ((u[0] + u[1]) * (TH / 2) - u[2] * ZS) / FS;
  const vx = (v[0] - v[1]) * (TW / 2) / FS;
  const vy = ((v[0] + v[1]) * (TH / 2) - v[2] * ZS) / FS;
  ctx.transform(ux, uy, vx, vy, O[0], O[1]);
}

/** direção mundial de um vetor local após rotação r */
function rotDir(dx: number, dy: number, r: number): [number, number] {
  let x = dx, y = dy;
  for (let i = 0; i < (r & 3); i++) {
    const nx = -y;
    const ny = x;
    x = nx; y = ny;
  }
  return [x, y];
}

/**
 * Desenha um box (já rotacionado) com origem de tela (ox, oy) correspondente ao tile (0,0,0) do móvel.
 * lightMul: multiplicador de iluminação ambiente (não usado aqui; o escurecimento é global).
 */
export function drawBox(ctx: CanvasRenderingContext2D, b: RotBox, ox: number, oy: number, t: number) {
  const x0 = b.x, y0 = b.y, z0 = b.z, x1 = b.x + b.w, y1 = b.y + b.d, z1 = b.z + b.h;
  const P = (x: number, y: number, z: number): [number, number] => [ox + isoX(x, y), oy + isoY(x, y, z)];
  const top = b.ct ?? shade(b.c, 0.14);
  const left = b.cl ?? b.c; // face +y
  const right = b.cr ?? shade(b.c, -0.2); // face +x
  ctx.save();
  if (b.alpha != null) ctx.globalAlpha *= b.alpha;

  const poly = (pts: [number, number][], fill: string) => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  // face +y (esquerda-frente)
  if (b.h > 0) {
    poly([P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0)], left);
    poly([P(x1, y1, z1), P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0)], right);
  }
  poly([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], top);

  // pinturas de face
  const paintFace = (worldFace: 'px' | 'py' | 'top') => {
    const localFace = worldFace === 'top' ? 'top' : b.faceMap[worldFace];
    if (!localFace) return;
    const paint = (b as unknown as Record<string, Paint | undefined>)[localFace];
    if (!paint) return;
    // base local da face, depois rotacionada
    const r = b.rot;
    // vetores locais
    let uL: [number, number], vL: [number, number] | null = null, wPx: number, hPx: number;
    // origem local relativa ao canto (x0,y0) do box local
    let oL: [number, number];
    const lw = b.lw, ld = b.ld;
    if (localFace === 'py') { oL = [0, ld]; uL = [1, 0]; wPx = lw * FS; hPx = b.h * FS; }
    else if (localFace === 'px') { oL = [lw, ld]; uL = [0, -1]; wPx = ld * FS; hPx = b.h * FS; }
    else if (localFace === 'my') { oL = [lw, 0]; uL = [-1, 0]; wPx = lw * FS; hPx = b.h * FS; }
    else if (localFace === 'mx') { oL = [0, 0]; uL = [0, 1]; wPx = ld * FS; hPx = b.h * FS; }
    else { oL = [0, 0]; uL = [1, 0]; vL = [0, 1]; wPx = lw * FS; hPx = ld * FS; }
    // converter origem local (relativa ao box) para mundo: o box local tem canto em (0,0)..(lw,ld);
    // o box rotacionado ocupa (x0..x1, y0..y1). Rotacionar ponto dentro do box.
    const rp = rotatePoint(oL[0], oL[1], lw, ld, r);
    const o: [number, number, number] = [x0 + rp.x, y0 + rp.y, z1];
    const ud = rotDir(uL[0], uL[1], r);
    const u: [number, number, number] = [ud[0], ud[1], 0];
    let v: [number, number, number];
    if (vL) { const vd = rotDir(vL[0], vL[1], r); v = [vd[0], vd[1], 0]; }
    else v = [0, 0, -1];
    ctx.save();
    faceTransform(ctx, ox, oy, o, u, v);
    ctx.beginPath();
    ctx.rect(0, 0, wPx, hPx);
    ctx.clip();
    paint(ctx, wPx, hPx, t);
    ctx.restore();
  };
  paintFace('py');
  paintFace('px');
  paintFace('top');

  if (b.outline !== false) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = OUTLINE;
    ctx.lineJoin = 'round';
    const sil = b.h > 0
      ? [P(x0, y0, z1), P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x0, y1, z0), P(x0, y1, z1)]
      : [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)];
    ctx.beginPath();
    ctx.moveTo(sil[0][0], sil[0][1]);
    for (let i = 1; i < sil.length; i++) ctx.lineTo(sil[i][0], sil[i][1]);
    ctx.closePath();
    ctx.stroke();
    if (b.h > 0) {
      // aresta frontal e bordas do topo (realce)
      ctx.strokeStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      const a = P(x1, y1, z1), c = P(x1, y1, z0);
      ctx.moveTo(a[0], a[1]); ctx.lineTo(c[0], c[1]);
      const l = P(x0, y1, z1), rr = P(x1, y0, z1);
      ctx.moveTo(l[0], l[1]); ctx.lineTo(a[0], a[1]); ctx.lineTo(rr[0], rr[1]);
      ctx.stroke();
    }
  }
  if (b.glass) {
    ctx.globalAlpha *= 0.35;
    ctx.strokeStyle = '#ffffff';
    const p1 = P(x0 + b.w * 0.2, y1, z1 - b.h * 0.1), p2 = P(x0 + b.w * 0.5, y1, z0 + b.h * 0.2);
    ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
  }
  ctx.restore();
}

/* --------- ordenação --------- */

export interface Sortable {
  x0: number; y0: number; z0: number; x1: number; y1: number; z1: number;
  // bbox de tela
  sx0: number; sy0: number; sx1: number; sy1: number;
}

export function screenBounds(s: Omit<Sortable, 'sx0' | 'sy0' | 'sx1' | 'sy1'>) {
  const xs = [isoX(s.x0, s.y1), isoX(s.x1, s.y0)];
  const sy0 = isoY(s.x0, s.y0, s.z1);
  const sy1 = isoY(s.x1, s.y1, s.z0);
  return { sx0: Math.min(...xs), sx1: Math.max(...xs), sy0, sy1 };
}

const EPS = 1e-4;
/** true se a está atrás de b (deve ser desenhado antes) */
export function isBehind(a: Sortable, b: Sortable): boolean {
  if (a.x1 <= b.x0 + EPS) return true;
  if (b.x1 <= a.x0 + EPS) return false;
  if (a.y1 <= b.y0 + EPS) return true;
  if (b.y1 <= a.y0 + EPS) return false;
  if (a.z1 <= b.z0 + EPS) return true;
  if (b.z1 <= a.z0 + EPS) return false;
  // sobreposição real: usa centro
  const ca = a.x0 + a.x1 + a.y0 + a.y1, cb = b.x0 + b.x1 + b.y0 + b.y1;
  if (Math.abs(ca - cb) > EPS) return ca < cb;
  return a.z0 + a.z1 < b.z0 + b.z1;
}

/** Ordenação topológica por sobreposição de tela (O(n²), ok para algumas centenas). */
export function depthSort<T extends Sortable>(items: T[]): T[] {
  const n = items.length;
  const behind: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const a = items[i];
    for (let j = i + 1; j < n; j++) {
      const b = items[j];
      if (a.sx1 <= b.sx0 || b.sx1 <= a.sx0 || a.sy1 <= b.sy0 || b.sy1 <= a.sy0) continue;
      if (isBehind(a, b)) behind[j].push(i);
      else behind[i].push(j);
    }
  }
  const out: T[] = [];
  const state = new Uint8Array(n);
  const order = items.map((_, i) => i).sort((i, j) => {
    const a = items[i], b = items[j];
    return (a.x0 + a.y0 + a.x1 + a.y1) - (b.x0 + b.y0 + b.x1 + b.y1) || a.z0 - b.z0;
  });
  const visit = (i: number) => {
    if (state[i] === 2) return;
    if (state[i] === 1) return; // ciclo: ignora
    state[i] = 1;
    for (const k of behind[i]) visit(k);
    state[i] = 2;
    out.push(items[i]);
  };
  for (const i of order) visit(i);
  return out;
}
