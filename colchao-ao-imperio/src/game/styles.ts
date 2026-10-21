import { hsl, shade } from '../engine/iso';
import type { Rarity } from './catalog';
import { rect } from './paints';

/** Pisos e papéis de parede: estilos aplicados ao imóvel inteiro. */
export interface StyleDef {
  id: string;
  name: string;
  kind: 'floor' | 'wall';
  price: number;
  rarity: Rarity;
  minLevel?: number;
  /** pinta UM tile de piso (32x32 na face superior) ou UM segmento de parede (32 x altura) */
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number, tx: number, ty: number, t: number) => void;
  sad?: boolean;
}

const S: StyleDef[] = [];
const add = (s: StyleDef) => S.push(s);

const noise = (tx: number, ty: number, k: number) => {
  const v = Math.sin(tx * 12.9898 + ty * 78.233 + k * 37.719) * 43758.5453;
  return v - Math.floor(v);
};

/* ----------- PISOS ----------- */

add({ id: 'piso-cimento-sujo', name: 'Cimento sujo e rachado', kind: 'floor', price: 0, rarity: 'sucata', sad: true, paint: (ctx, w, h, tx, ty) => {
  rect(ctx, 0, 0, w, h, '#8d8676');
  for (let i = 0; i < 6; i++) rect(ctx, noise(tx, ty, i) * w, noise(ty, tx, i) * h, 2 + noise(tx, ty, i + 9) * 4, 2, i % 2 ? '#7a7363' : '#9b9483');
  if (noise(tx, ty, 99) > 0.6) { ctx.strokeStyle = '#5e584b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(noise(tx, ty, 3) * w, 0); ctx.lineTo(w / 2, h / 2); ctx.lineTo(noise(tx, ty, 4) * w, h); ctx.stroke(); }
  if (noise(tx, ty, 55) > 0.82) { ctx.fillStyle = 'rgba(70,50,20,0.35)'; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, 8, 6, 0, 0, 7); ctx.fill(); }
  rect(ctx, 0, 0, w, 1, 'rgba(0,0,0,0.12)'); rect(ctx, 0, 0, 1, h, 'rgba(0,0,0,0.12)');
} });
add({ id: 'piso-taco-velho', name: 'Taco velho soltando', kind: 'floor', price: 15, rarity: 'sucata', paint: (ctx, w, h, tx, ty) => {
  const c = '#9a6b3c';
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const vert = (i + j + tx + ty) % 2 === 0;
    const x = vert ? i * 8 : 0, y = vert ? j * 16 : i * 8;
    rect(ctx, x, y, vert ? 8 : w, vert ? 16 : 8, shade(c, (noise(tx + i, ty + j, 1) - 0.5) * 0.25));
    ctx.strokeStyle = 'rgba(40,20,5,0.35)'; ctx.strokeRect(x + 0.5, y + 0.5, (vert ? 8 : w) - 1, (vert ? 16 : 8) - 1);
  }
  if (noise(tx, ty, 7) > 0.85) rect(ctx, 8, 8, 8, 16, '#4b3a26');
} });
add({ id: 'piso-ceramica-branca', name: 'Cerâmica branca', kind: 'floor', price: 30, rarity: 'comum', paint: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#e8e6df'); rect(ctx, 0, 0, w, 1, '#c9c6bc'); rect(ctx, 0, 0, 1, h, '#c9c6bc'); rect(ctx, 3, 3, 6, 2, '#f7f6f2'); } });
add({ id: 'piso-ceramica-bege', name: 'Cerâmica bege', kind: 'floor', price: 30, rarity: 'comum', paint: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#d8c7a1'); rect(ctx, 0, 0, w, 1, '#b9a67f'); rect(ctx, 0, 0, 1, h, '#b9a67f'); } });
const wood = (id: string, name: string, c: string, price: number, r: Rarity) => add({ id, name, kind: 'floor', price, rarity: r, paint: (ctx, w, h, tx, ty) => {
  for (let i = 0; i < 4; i++) {
    rect(ctx, 0, i * 8, w, 8, shade(c, (noise(tx, ty + i, 2) - 0.5) * 0.18));
    rect(ctx, 0, i * 8 + 7, w, 1, shade(c, -0.3));
    const off = (noise(ty, i, tx) * w) | 0;
    rect(ctx, off, i * 8, 1, 8, shade(c, -0.3));
  }
} });
wood('piso-laminado', 'Piso laminado claro', '#c9a06b', 70, 'comum');
wood('piso-madeira', 'Assoalho de madeira', '#a8713f', 110, 'incomum');
wood('piso-madeira-escura', 'Assoalho escuro', '#6b4226', 140, 'incomum');
wood('piso-carvalho-cinza', 'Carvalho acinzentado', '#9b948a', 160, 'incomum');
add({ id: 'piso-carpete-cinza', name: 'Carpete cinza de escritório', kind: 'floor', price: 60, rarity: 'comum', paint: (ctx, w, h, tx, ty) => { rect(ctx, 0, 0, w, h, '#6f7480'); for (let i = 0; i < 20; i++) rect(ctx, noise(tx, ty, i) * w, noise(ty, tx, i) * h, 1, 1, i % 2 ? '#7d828e' : '#626773'); } });
add({ id: 'piso-carpete-azul', name: 'Carpete azul', kind: 'floor', price: 70, rarity: 'comum', paint: (ctx, w, h, tx, ty) => { rect(ctx, 0, 0, w, h, '#33558f'); for (let i = 0; i < 20; i++) rect(ctx, noise(tx, ty, i) * w, noise(ty, tx, i) * h, 1, 1, '#3d64a6'); } });
add({ id: 'piso-carpete-placa', name: 'Carpete em placas (escritório)', kind: 'floor', price: 120, rarity: 'incomum', paint: (ctx, w, h, tx, ty) => { const c = (tx + ty) % 2 ? '#4a5160' : '#555d6d'; rect(ctx, 0, 0, w, h, c); ctx.fillStyle = shade(c, -0.15); for (let y = 2; y < h; y += 4) ctx.fillRect(0, y, w, 1); } });
add({ id: 'piso-xadrez', name: 'Piso xadrez retrô', kind: 'floor', price: 90, rarity: 'incomum', paint: (ctx, w, h, tx, ty) => { rect(ctx, 0, 0, w, h, (tx + ty) % 2 ? '#1d1d1d' : '#efefef'); } });
add({ id: 'piso-ladrilho-hidraulico', name: 'Ladrilho hidráulico', kind: 'floor', price: 150, rarity: 'raro', paint: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#f2ead8'); ctx.fillStyle = '#2f6f8f'; ctx.beginPath(); ctx.moveTo(w / 2, 2); ctx.lineTo(w - 2, h / 2); ctx.lineTo(w / 2, h - 2); ctx.lineTo(2, h / 2); ctx.fill(); ctx.fillStyle = '#c0533a'; ctx.fillRect(w / 2 - 4, h / 2 - 4, 8, 8); rect(ctx, 0, 0, w, 1, '#c8bfa9'); rect(ctx, 0, 0, 1, h, '#c8bfa9'); } });
add({ id: 'piso-porcelanato', name: 'Porcelanato polido', kind: 'floor', price: 220, rarity: 'raro', paint: (ctx, w, h, tx, ty) => { rect(ctx, 0, 0, w, h, '#dcdcdc'); rect(ctx, 0, 0, w, 1, '#bdbdbd'); rect(ctx, 0, 0, 1, h, '#bdbdbd'); ctx.fillStyle = 'rgba(255,255,255,0.35)'; if ((tx + ty) % 3 === 0) ctx.fillRect(4, 4, w - 8, 3); } });
add({ id: 'piso-marmore', name: 'Mármore Carrara', kind: 'floor', price: 650, rarity: 'epico', minLevel: 10, paint: (ctx, w, h, tx, ty) => { rect(ctx, 0, 0, w, h, '#f1f0ec'); ctx.strokeStyle = 'rgba(120,120,130,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, noise(tx, ty, 1) * h); ctx.bezierCurveTo(w * 0.3, noise(tx, ty, 2) * h, w * 0.6, noise(tx, ty, 3) * h, w, noise(tx + 1, ty, 1) * h); ctx.stroke(); rect(ctx, 0, 0, w, 1, '#d6d4cd'); rect(ctx, 0, 0, 1, h, '#d6d4cd'); } });
add({ id: 'piso-marmore-preto', name: 'Mármore Nero Marquina', kind: 'floor', price: 900, rarity: 'epico', minLevel: 12, paint: (ctx, w, h, tx, ty) => { rect(ctx, 0, 0, w, h, '#1c1c1f'); ctx.strokeStyle = 'rgba(240,240,240,0.4)'; ctx.beginPath(); ctx.moveTo(0, noise(tx, ty, 1) * h); ctx.lineTo(w, noise(tx + 1, ty, 1) * h); ctx.stroke(); rect(ctx, 0, 0, w, 1, '#333'); } });
add({ id: 'piso-gamer', name: 'Piso gamer com LED', kind: 'floor', price: 380, rarity: 'raro', paint: (ctx, w, h, tx, ty, t) => { rect(ctx, 0, 0, w, h, '#15151d'); ctx.strokeStyle = hsl(t * 40 + (tx + ty) * 20, 100, 55); ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, w - 1, h - 1); } });
add({ id: 'piso-ouro', name: 'Piso folheado a ouro', kind: 'floor', price: 3000, rarity: 'lendario', minLevel: 18, paint: (ctx, w, h, tx, ty, t) => { rect(ctx, 0, 0, w, h, '#d4a93a'); rect(ctx, 0, 0, w, 1, '#a07b22'); rect(ctx, 0, 0, 1, h, '#a07b22'); if (Math.sin(t * 2 + tx + ty * 2) > 0.92) rect(ctx, w / 2, h / 2, 3, 3, '#fff6c9'); } });
add({ id: 'piso-grama', name: 'Grama sintética', kind: 'floor', price: 140, rarity: 'incomum', paint: (ctx, w, h, tx, ty) => { rect(ctx, 0, 0, w, h, '#4f9a45'); for (let i = 0; i < 25; i++) rect(ctx, noise(tx, ty, i) * w, noise(ty, tx, i) * h, 1, 2, i % 2 ? '#62b356' : '#3f8236'); } });
add({ id: 'piso-tatame', name: 'Tatame', kind: 'floor', price: 180, rarity: 'raro', paint: (ctx, w, h, tx, ty) => { rect(ctx, 0, 0, w, h, '#cdbb7e'); ctx.fillStyle = '#b9a76b'; for (let y = 1; y < h; y += 2) ctx.fillRect(0, y, w, 1); if ((tx + ty) % 2) rect(ctx, 0, 0, 2, h, '#2f4f2f'); else rect(ctx, 0, 0, w, 2, '#2f4f2f'); } });

/* ----------- PAREDES ----------- */

add({ id: 'parede-descascada', name: 'Parede descascada e manchada', kind: 'wall', price: 0, rarity: 'sucata', sad: true, paint: (ctx, w, h, tx) => {
  rect(ctx, 0, 0, w, h, '#b9b29c');
  ctx.fillStyle = '#a49c84';
  for (let i = 0; i < 4; i++) { const x = noise(tx, i, 1) * w, y = noise(i, tx, 2) * h; ctx.beginPath(); ctx.ellipse(x, y, 4 + noise(tx, i, 3) * 6, 3 + noise(tx, i, 4) * 4, 0, 0, 7); ctx.fill(); }
  // reboco aparecendo
  if (noise(tx, 0, 5) > 0.4) { const x = noise(tx, 1, 6) * (w - 12), y = noise(tx, 2, 7) * (h - 16) + 8; rect(ctx, x, y, 12, 8, '#8a6f58'); rect(ctx, x + 1, y + 1, 4, 3, '#9b7d63'); rect(ctx, x + 6, y + 4, 5, 3, '#7a604b'); }
  // mancha de umidade
  const g = ctx.createLinearGradient(0, h, 0, h * 0.6);
  g.addColorStop(0, 'rgba(90,80,50,0.45)'); g.addColorStop(1, 'rgba(90,80,50,0)');
  ctx.fillStyle = g; ctx.fillRect(0, h * 0.6, w, h * 0.4);
  if (noise(tx, 3, 8) > 0.55) { ctx.strokeStyle = '#6e6650'; ctx.lineWidth = 1; ctx.beginPath(); const x = noise(tx, 4, 9) * w; ctx.moveTo(x, 0); ctx.lineTo(x + 4, h * 0.2); ctx.lineTo(x - 2, h * 0.35); ctx.lineTo(x + 3, h * 0.5); ctx.stroke(); }
} });
add({ id: 'parede-reboco', name: 'Reboco cru', kind: 'wall', price: 10, rarity: 'sucata', paint: (ctx, w, h, tx) => { rect(ctx, 0, 0, w, h, '#a79a88'); for (let i = 0; i < 30; i++) rect(ctx, noise(tx, i, 1) * w, noise(i, tx, 2) * h, 2, 1, i % 2 ? '#988b79' : '#b4a796'); } });
const plain = (id: string, name: string, c: string, price: number, r: Rarity) => add({ id, name, kind: 'wall', price, rarity: r, paint: (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); rect(ctx, 0, h - 4, w, 4, shade(c, -0.25)); } });
plain('parede-branca', 'Pintura branca', '#ecebe6', 25, 'comum');
plain('parede-bege', 'Pintura bege', '#e4d5b7', 25, 'comum');
plain('parede-azul', 'Pintura azul', '#8fb3d9', 35, 'comum');
plain('parede-verde', 'Pintura verde-sálvia', '#a8c3a0', 35, 'comum');
plain('parede-rosa', 'Pintura rosa', '#f2c4d0', 35, 'comum');
plain('parede-cinza', 'Cinza moderno', '#9ea3ab', 45, 'comum');
plain('parede-grafite', 'Grafite escuro', '#3b3f47', 60, 'incomum');
plain('parede-terracota', 'Terracota', '#c9785a', 60, 'incomum');
add({ id: 'parede-listrada', name: 'Papel de parede listrado', kind: 'wall', price: 80, rarity: 'incomum', paint: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#efe3c8'); ctx.fillStyle = '#d9c49a'; for (let x = 0; x < w; x += 8) ctx.fillRect(x, 0, 4, h); rect(ctx, 0, h - 4, w, 4, '#8b6a3e'); } });
add({ id: 'parede-tijolo', name: 'Tijolinho aparente', kind: 'wall', price: 140, rarity: 'incomum', paint: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#d6cfc4'); for (let r = 0; r * 6 < h; r++) for (let c = -1; c * 12 < w; c++) { const x = c * 12 + (r % 2) * 6; rect(ctx, x + 1, r * 6 + 1, 10, 4, r % 3 === 0 ? '#a85a3c' : r % 3 === 1 ? '#b8664a' : '#9a5034'); } } });
add({ id: 'parede-madeira', name: 'Painel de madeira (boiserie)', kind: 'wall', price: 220, rarity: 'raro', paint: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#efe7da'); rect(ctx, 0, h * 0.55, w, h * 0.45, '#8a5a34'); rect(ctx, 3, h * 0.6, w - 6, h * 0.35, '#7a4c2a'); rect(ctx, 0, h * 0.55, w, 2, '#5e3a1f'); } });
add({ id: 'parede-ripada', name: 'Parede ripada', kind: 'wall', price: 260, rarity: 'raro', paint: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#b07a47'); for (let x = 0; x < w; x += 4) rect(ctx, x, 0, 1, h, '#7a522c'); } });
add({ id: 'parede-gamer', name: 'Parede gamer hexagonal', kind: 'wall', price: 300, rarity: 'raro', paint: (ctx, w, h, tx, t) => { rect(ctx, 0, 0, w, h, '#1b1b26'); for (let r = 0; r * 10 < h; r++) for (let c = 0; c * 10 < w + 10; c++) { const lit = noise(tx + c, r, Math.floor(t)) > 0.8; ctx.strokeStyle = lit ? hsl(t * 40 + r * 20, 100, 60) : '#2b2b3a'; ctx.strokeRect(c * 10 - (r % 2) * 5 + 1, r * 10 + 1, 8, 8); } } });
add({ id: 'parede-concreto', name: 'Concreto aparente', kind: 'wall', price: 200, rarity: 'raro', paint: (ctx, w, h, tx) => { rect(ctx, 0, 0, w, h, '#a3a39e'); for (let y = 0; y < h; y += 20) rect(ctx, 0, y, w, 1, '#8b8b86'); [[6, 6], [w - 6, 6], [6, 16], [w - 6, 16]].forEach(([x, y]) => rect(ctx, x, y, 2, 2, '#7f7f7a')); for (let i = 0; i < 10; i++) rect(ctx, noise(tx, i, 3) * w, noise(i, tx, 3) * h, 1, 1, '#93938e'); } });
add({ id: 'parede-vidro', name: 'Fachada de vidro', kind: 'wall', price: 800, rarity: 'epico', minLevel: 11, paint: (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9cc9ef'); g.addColorStop(1, '#d4ebff'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.fillStyle = 'rgba(80,110,140,0.5)'; for (let i = 0; i < 4; i++) ctx.fillRect(i * 8 + 2, h - 20 - (i * 7) % 15, 6, 40); rect(ctx, 0, 0, 2, h, '#2b2f36'); rect(ctx, 0, h * 0.5, w, 2, '#2b2f36'); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(w * 0.3, 0, 3, h); } });
add({ id: 'parede-marmore', name: 'Revestimento de mármore', kind: 'wall', price: 1100, rarity: 'epico', minLevel: 13, paint: (ctx, w, h, tx) => { rect(ctx, 0, 0, w, h, '#efede8'); ctx.strokeStyle = 'rgba(120,120,130,0.35)'; ctx.beginPath(); ctx.moveTo(0, noise(tx, 1, 1) * h); ctx.bezierCurveTo(w * 0.3, noise(tx, 2, 1) * h, w * 0.7, noise(tx, 3, 1) * h, w, noise(tx + 1, 1, 1) * h); ctx.stroke(); rect(ctx, 0, h - 5, w, 5, '#c9a227'); } });
add({ id: 'parede-dourada', name: 'Papel de parede damasco dourado', kind: 'wall', price: 2600, rarity: 'lendario', minLevel: 17, paint: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#3d1b24'); ctx.fillStyle = '#c9a227'; for (let y = 4; y < h; y += 14) for (let x = (y / 14) % 2 ? 8 : 0; x < w; x += 16) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 5); ctx.lineTo(x, y + 10); ctx.lineTo(x - 4, y + 5); ctx.fill(); } rect(ctx, 0, h - 5, w, 5, '#c9a227'); } });

export const STYLE_LIST = S;
export const STYLES_BY_ID: Record<string, StyleDef> = Object.fromEntries(S.map((s) => [s.id, s]));
export const getStyle = (id: string) => STYLES_BY_ID[id];

/** Temas de iluminação (gratuitos) */
export const LIGHT_THEMES: Record<string, { name: string; ambient: number; tint: string }> = {
  quente: { name: 'Quente aconchegante', ambient: 0.28, tint: '#ffb066' },
  neutra: { name: 'Neutra', ambient: 0.12, tint: '#ffffff' },
  fria: { name: 'Fria de escritório', ambient: 0.14, tint: '#9fc4ff' },
  neon: { name: 'Neon noturno', ambient: 0.45, tint: '#8a5cff' },
  sombria: { name: 'Sombria (precária)', ambient: 0.42, tint: '#c9b37a' },
};
