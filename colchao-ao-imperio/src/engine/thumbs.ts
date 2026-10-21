import { getItem, type ItemDef } from '../game/catalog';
import type { StyleDef } from '../game/styles';
import { isoX, isoY, TH, TW, ZS } from './iso';
import { depthSort, drawBox, FS, rotateBox, rotatePoint, screenBounds, type RotBox, type SpritePrim, type Sortable } from './prims';

type D = (Sortable & { kind: 'box'; b: RotBox }) | (Sortable & { kind: 'spr'; s: SpritePrim; x: number; y: number; z: number });

/** Desenha um item isolado, centralizado no canvas. */
export function drawItemThumb(canvas: HTMLCanvasElement, def: ItemDef, t = 0, rot = 0) {
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  if (def.place === 'wall' && def.wallPaint) {
    const w = def.w * FS, h = (def.wallH ?? 1) * FS;
    const scale = Math.min((canvas.width * 0.8) / w, (canvas.height * 0.8) / h);
    ctx.translate((canvas.width - w * scale) / 2, (canvas.height - h * scale) / 2);
    ctx.scale(scale, scale);
    // um pedacinho de parede ao fundo
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(-4, -4, w + 8, h + 8);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    def.wallPaint(ctx, w, h, t);
    ctx.restore();
    return;
  }
  const prims = def.model ? def.model() : [];
  const list: D[] = [];
  for (const p of prims) {
    if (p.t === 'box') {
      const b = rotateBox(p, def.w, def.d, rot);
      const s = { x0: b.x, y0: b.y, z0: b.z, x1: b.x + b.w, y1: b.y + b.d, z1: b.z + b.h };
      list.push({ kind: 'box', b, ...s, ...screenBounds(s) });
    } else {
      const rp = rotatePoint(p.x, p.y, def.w, def.d, rot);
      const r = p.r ?? 0.2, h = p.h ?? 0.5;
      const s = { x0: rp.x - r, y0: rp.y - r, z0: p.z, x1: rp.x + r, y1: rp.y + r, z1: p.z + h };
      list.push({ kind: 'spr', s: p, x: rp.x, y: rp.y, z: p.z, ...s, ...screenBounds(s) });
    }
  }
  if (!list.length) return;
  // limites
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const fw = rot & 1 ? def.d : def.w, fd = rot & 1 ? def.w : def.d;
  const corners = [[0, 0], [fw, 0], [0, fd], [fw, fd]];
  for (const d of list) {
    minX = Math.min(minX, d.sx0); maxX = Math.max(maxX, d.sx1); minY = Math.min(minY, d.sy0 - (d.kind === 'spr' ? 24 : 0)); maxY = Math.max(maxY, d.sy1);
  }
  // objetos pequenos: garante um tamanho mínimo de enquadramento para não ficarem minúsculos
  const MIN = 34;
  if (maxX - minX < MIN) { const c = (minX + maxX) / 2; minX = c - MIN / 2; maxX = c + MIN / 2; }
  if (maxY - minY < MIN) { const c = (minY + maxY) / 2; minY = c - MIN / 2; maxY = c + MIN / 2; }
  void corners;
  const bw = maxX - minX, bh = maxY - minY;
  const scale = Math.max(0.5, Math.min((canvas.width * 0.86) / bw, (canvas.height * 0.86) / bh, 4));
  ctx.translate(canvas.width / 2 - ((minX + maxX) / 2) * scale, canvas.height / 2 - ((minY + maxY) / 2) * scale);
  ctx.scale(scale, scale);
  // base (losango do footprint)
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  [[0, 0], [fw, 0], [fw, fd], [0, fd]].forEach(([x, y], i) => (i ? ctx.lineTo(isoX(x, y), isoY(x, y)) : ctx.moveTo(isoX(x, y), isoY(x, y))));
  ctx.fill();
  for (const d of depthSort(list)) {
    if (d.kind === 'box') drawBox(ctx, d.b, 0, 0, t);
    else { ctx.save(); ctx.translate(isoX(d.x, d.y), isoY(d.x, d.y, d.z)); d.s.draw(ctx, t, rot); ctx.restore(); }
  }
}

export function drawStyleThumb(canvas: HTMLCanvasElement, st: StyleDef, t = 0) {
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  const n = 3;
  const scale = Math.min(canvas.width / (n * TW + 8), canvas.height / (n * TH + 8 + (st.kind === 'wall' ? 2.4 * ZS : 0)));
  ctx.translate(canvas.width / 2, canvas.height / 2 - (st.kind === 'wall' ? 0 : n * TH * scale * 0.5));
  ctx.scale(scale, scale);
  if (st.kind === 'floor') {
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) {
      ctx.save();
      ctx.translate(isoX(x, y), isoY(x, y));
      ctx.transform((TW / 2) / FS, (TH / 2) / FS, -(TW / 2) / FS, (TH / 2) / FS, 0, 0);
      ctx.beginPath(); ctx.rect(0, 0, FS, FS); ctx.clip();
      st.paint(ctx, FS, FS, x, y, t);
      ctx.restore();
    }
  } else {
    const H = 2.4 * FS;
    ctx.translate(-TW * 1.5 / 2 * 0, -H / 2);
    for (let i = 0; i < n; i++) {
      ctx.save();
      ctx.translate(-((n * FS) / 2) + i * FS, 0);
      ctx.beginPath(); ctx.rect(0, 0, FS, H); ctx.clip();
      st.paint(ctx, FS, H, i, 0, t);
      ctx.restore();
    }
  }
}

const cache = new Map<string, string>();
/** Data URL de miniatura (cacheada) */
export function itemThumbURL(defId: string, size = 96): string {
  const k = `${defId}@${size}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const def = getItem(defId);
  if (!def) return '';
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  drawItemThumb(c, def, 0.5);
  const url = c.toDataURL();
  cache.set(k, url);
  return url;
}
