import { hsl, shade, withAlpha } from '../engine/iso';
import { box, spr, type Paint, type Prim } from '../engine/prims';
import {
  artPaint, booksPaint, cushionPaint, doorsPaint, drawersPaint, fanPaint, framePaint, keysPaint,
  pcFrontPaint, plankPaint, rect, rugPaint, screenPaint, stripesPaint, windowPaint,
} from './paints';

export type CatId =
  | 'computadores' | 'monitores' | 'cadeiras' | 'mesas' | 'perifericos' | 'audio' | 'iluminacao'
  | 'tapetes' | 'camas' | 'sofas' | 'armarios' | 'estantes' | 'paredes' | 'plantas' | 'janelas'
  | 'climatizacao' | 'tv' | 'consoles' | 'cozinha' | 'colecionaveis' | 'escritorio' | 'fixos';

export const CATEGORIES: { id: CatId; name: string }[] = [
  { id: 'computadores', name: 'Computadores' },
  { id: 'monitores', name: 'Monitores' },
  { id: 'cadeiras', name: 'Cadeiras' },
  { id: 'mesas', name: 'Mesas' },
  { id: 'perifericos', name: 'Teclados, mouses e cia' },
  { id: 'audio', name: 'Áudio e vídeo' },
  { id: 'iluminacao', name: 'Iluminação' },
  { id: 'tapetes', name: 'Tapetes' },
  { id: 'camas', name: 'Camas' },
  { id: 'sofas', name: 'Sofás e poltronas' },
  { id: 'armarios', name: 'Armários' },
  { id: 'estantes', name: 'Estantes' },
  { id: 'paredes', name: 'Quadros e pôsteres' },
  { id: 'janelas', name: 'Janelas, portas e cortinas' },
  { id: 'plantas', name: 'Plantas' },
  { id: 'climatizacao', name: 'Ventiladores e ar' },
  { id: 'tv', name: 'Televisões' },
  { id: 'consoles', name: 'Consoles e games' },
  { id: 'cozinha', name: 'Cafeteiras e frigobares' },
  { id: 'colecionaveis', name: 'Colecionáveis' },
  { id: 'escritorio', name: 'Escritório' },
];

export type Rarity = 'sucata' | 'comum' | 'incomum' | 'raro' | 'epico' | 'lendario';
export const RARITY_INFO: Record<Rarity, { name: string; color: string }> = {
  sucata: { name: 'Sucata', color: '#9b8f7a' },
  comum: { name: 'Comum', color: '#c9d1d9' },
  incomum: { name: 'Incomum', color: '#4ade80' },
  raro: { name: 'Raro', color: '#60a5fa' },
  epico: { name: 'Épico', color: '#c084fc' },
  lendario: { name: 'Lendário', color: '#fbbf24' },
};

export type UseKind = 'computer' | 'tv' | 'coffee' | 'fridge' | 'plant' | 'music' | 'game' | 'read' | 'fan' | 'money' | 'water' | 'print';

export interface ItemDef {
  id: string;
  name: string;
  cat: CatId;
  price: number;
  rarity: Rarity;
  w: number;
  d: number;
  /** floor = chão; top = sobre mesas/superfícies ou chão; wall = parede; rug = tapete (passável) */
  place: 'floor' | 'top' | 'wall' | 'rug';
  surface?: number;
  sit?: number;
  sleep?: number;
  use?: UseKind;
  light?: { color: string; r: number; z: number; x?: number; y?: number };
  model?: () => Prim[];
  /** itens de parede */
  wallPaint?: Paint;
  wallH?: number;
  wallZ?: number;
  minLevel?: number;
  event?: string;
  collection?: string;
  fixture?: boolean; // não aparece na loja
  desc?: string;
  /** item "sujeira" que conta como precário */
  sad?: boolean;
}

const ITEMS: ItemDef[] = [];
const add = (d: ItemDef) => { ITEMS.push(d); return d; };

/* ===================== helpers geométricos ===================== */

function legs4(x0: number, y0: number, w: number, d: number, h: number, c: string, t = 0.06): Prim[] {
  return [
    box(x0, y0, 0, t, t, h, c), box(x0 + w - t, y0, 0, t, t, h, c),
    box(x0, y0 + d - t, 0, t, t, h, c), box(x0 + w - t, y0 + d - t, 0, t, t, h, c),
  ];
}

const leafBlob = (colors: string[], size: number, count: number, seed = 1) =>
  (ctx: CanvasRenderingContext2D, t: number) => {
    for (let i = 0; i < count; i++) {
      const a = (i * 2.399 + seed) % (Math.PI * 2);
      const rr = size * (0.3 + ((i * 37 + seed * 11) % 10) / 14);
      const sway = Math.sin(t * 1.5 + i) * 0.6;
      const x = Math.cos(a) * rr + sway;
      const y = -size * 0.6 + Math.sin(a) * rr * 0.6 - ((i * 13) % 7);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(Math.round(x - 3), Math.round(y - 2), 6, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(Math.round(x - 2), Math.round(y - 2), 3, 1);
    }
  };

const PALETTE = {
  white: '#e9e6df', black: '#2a2a33', gray: '#7c8191', beige: '#d8c7a1', yellowed: '#cdbb8a', wood: '#a8713f',
  darkwood: '#6b4226', lightwood: '#d2a66b', mahogany: '#7a2e1f', red: '#c0392b', blue: '#2f6fd1', green: '#2e9e5b',
  pink: '#e86fb0', purple: '#8e52d6', orange: '#e67e22', teal: '#1aa39a', gold: '#e2b53f', silver: '#b9c0cc', navy: '#2b3a67',
};
type ColorName = keyof typeof PALETTE;
const COLOR_LABEL: Record<ColorName, string> = {
  white: 'branco', black: 'preto', gray: 'cinza', beige: 'bege', yellowed: 'amarelado', wood: 'madeira', darkwood: 'madeira escura',
  lightwood: 'madeira clara', mahogany: 'mogno', red: 'vermelho', blue: 'azul', green: 'verde', pink: 'rosa', purple: 'roxo',
  orange: 'laranja', teal: 'turquesa', gold: 'dourado', silver: 'prata', navy: 'marinho',
};

function variants<T extends ColorName>(colors: T[], fn: (c: string, name: T, i: number) => void) {
  colors.forEach((n, i) => fn(PALETTE[n], n, i));
}

/* ===================== COMPUTADORES ===================== */

type PcKind = 'old' | 'basic' | 'window' | 'rgb1' | 'rgb3' | 'mid' | 'premium' | 'work' | 'future';
function pcModel(kind: PcKind, c: string): () => Prim[] {
  return () => {
    const tall = kind === 'work' || kind === 'premium' ? 0.62 : kind === 'old' ? 0.48 : 0.55;
    const front = pcFrontPaint(c, kind === 'old' ? '#7cff6b' : kind === 'future' ? '#00e5ff' : '#4dd2ff', kind === 'old' ? 3 : 1);
    let side: Paint | undefined;
    if (kind === 'window') side = fanPaint(1, false, c);
    if (kind === 'rgb1') side = fanPaint(1, true, c);
    if (kind === 'rgb3' || kind === 'mid') side = fanPaint(3, true, c);
    if (kind === 'premium') side = fanPaint(3, true, c);
    if (kind === 'work') side = (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); for (let y = 3; y < h - 2; y += 3) rect(ctx, 3, y, w - 6, 1, shade(c, -0.3)); };
    if (kind === 'future') side = (ctx, w, h, t) => { rect(ctx, 0, 0, w, h, '#0b0f1a'); ctx.strokeStyle = hsl(180 + Math.sin(t) * 40, 100, 60); ctx.lineWidth = 1; ctx.strokeRect(2, 2, w - 4, h - 4); ctx.beginPath(); ctx.moveTo(4, h - 4); ctx.lineTo(w / 2, 6); ctx.lineTo(w - 4, h - 4); ctx.stroke(); };
    if (kind === 'old') side = (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); rect(ctx, 3, h - 8, 6, 3, shade(c, -0.25)); rect(ctx, w - 10, 4, 7, 2, '#8a7a50'); };
    const prims: Prim[] = [box(0.32, 0.22, 0, 0.36, 0.56, tall, c, { py: front, px: side, glass: kind === 'window' || kind.startsWith('rgb') || kind === 'mid' || kind === 'premium' })];
    if (kind === 'future') prims.push(spr(0.5, 0.5, tall + 0.05, (ctx, t) => { ctx.fillStyle = hsl(t * 80, 100, 65); ctx.globalAlpha = 0.6 + Math.sin(t * 3) * 0.3; ctx.fillRect(-4, -2 - Math.sin(t * 2) * 2, 8, 2); ctx.globalAlpha = 1; }, 0.2, 0.2));
    if (kind === 'premium') prims.push(box(0.3, 0.2, tall, 0.4, 0.6, 0.03, '#222'));
    return prims;
  };
}
add({ id: 'pc-amarelado', name: 'Gabinete antigo amarelado', cat: 'computadores', price: 0, rarity: 'sucata', w: 1, d: 1, place: 'top', use: 'computer', model: pcModel('old', PALETTE.yellowed), desc: 'Ruído de avião decolando incluso.', sad: true });
add({ id: 'pc-preto-basico', name: 'Gabinete preto básico', cat: 'computadores', price: 45, rarity: 'comum', w: 1, d: 1, place: 'top', use: 'computer', model: pcModel('basic', '#2b2d35') });
add({ id: 'pc-branco-basico', name: 'Gabinete branco básico', cat: 'computadores', price: 45, rarity: 'comum', w: 1, d: 1, place: 'top', use: 'computer', model: pcModel('basic', '#e3e3e8') });
add({ id: 'pc-lateral-vidro', name: 'Gabinete com lateral transparente', cat: 'computadores', price: 110, rarity: 'incomum', w: 1, d: 1, place: 'top', use: 'computer', model: pcModel('window', '#30323c') });
variants(['black', 'white', 'pink'], (c, n) => add({ id: `pc-rgb1-${n}`, name: `PC com uma ventoinha RGB (${COLOR_LABEL[n]})`, cat: 'computadores', price: 180, rarity: 'incomum', w: 1, d: 1, place: 'top', use: 'computer', model: pcModel('rgb1', c), collection: 'rgb' }));
variants(['black', 'white', 'purple'], (c, n) => add({ id: `pc-rgb3-${n}`, name: `PC com três ventoinhas RGB (${COLOR_LABEL[n]})`, cat: 'computadores', price: 320, rarity: 'raro', w: 1, d: 1, place: 'top', use: 'computer', model: pcModel('rgb3', c), collection: 'rgb' }));
add({ id: 'pc-gamer-medio', name: 'PC gamer intermediário', cat: 'computadores', price: 480, rarity: 'raro', w: 1, d: 1, place: 'top', use: 'computer', model: pcModel('mid', '#1c1f2b'), collection: 'gamer' });
add({ id: 'pc-gamer-premium', name: 'PC gamer premium', cat: 'computadores', price: 1100, rarity: 'epico', w: 1, d: 1, place: 'top', use: 'computer', model: pcModel('premium', '#14161f'), minLevel: 6, collection: 'gamer' });
add({ id: 'pc-workstation', name: 'Workstation profissional', cat: 'computadores', price: 1600, rarity: 'epico', w: 1, d: 1, place: 'top', use: 'computer', model: pcModel('work', '#9ea4ae'), minLevel: 8, collection: 'ceo' });
add({ id: 'pc-futurista', name: 'Computador futurista', cat: 'computadores', price: 4200, rarity: 'lendario', w: 1, d: 1, place: 'top', use: 'computer', model: pcModel('future', '#0b0f1a'), minLevel: 15, collection: 'futuro' });
add({ id: 'notebook-velho', name: 'Notebook velho de tampa riscada', cat: 'computadores', price: 30, rarity: 'sucata', w: 1, d: 1, place: 'top', use: 'computer', model: () => [box(0.2, 0.35, 0, 0.6, 0.4, 0.04, '#555a66', { top: keysPaint('#3d414b') }), box(0.2, 0.3, 0.04, 0.6, 0.05, 0.38, '#555a66', { py: screenPaint('code', 2, '#3d414b') })] });
add({ id: 'notebook-prata', name: 'Notebook prata', cat: 'computadores', price: 260, rarity: 'incomum', w: 1, d: 1, place: 'top', use: 'computer', model: () => [box(0.2, 0.35, 0, 0.6, 0.4, 0.03, '#c7ccd6', { top: keysPaint('#a3a9b5') }), box(0.2, 0.31, 0.03, 0.6, 0.04, 0.36, '#c7ccd6', { py: screenPaint('chart', 2, '#1a1a1a') })] });
add({ id: 'notebook-gamer', name: 'Notebook gamer RGB', cat: 'computadores', price: 520, rarity: 'raro', w: 1, d: 1, place: 'top', use: 'computer', model: () => [box(0.18, 0.35, 0, 0.64, 0.42, 0.05, '#1d1f29', { top: keysPaint('#14151c', true) }), box(0.18, 0.3, 0.05, 0.64, 0.05, 0.38, '#1d1f29', { py: screenPaint('game', 2, '#0b0b0b') })], collection: 'gamer' });
add({ id: 'servidor-caseiro', name: 'Servidor caseiro (mini rack)', cat: 'computadores', price: 700, rarity: 'raro', w: 1, d: 1, place: 'floor', use: 'computer', model: () => [box(0.2, 0.2, 0, 0.6, 0.6, 1.0, '#2a2d36', { py: (ctx, w, h, t) => { rect(ctx, 0, 0, w, h, '#22252d'); for (let i = 0; i < 6; i++) { rect(ctx, 2, 3 + i * 5, w - 4, 4, '#353945'); rect(ctx, w - 6, 4 + i * 5, 2, 2, Math.sin(t * 7 + i * 2) > 0 ? '#4ade80' : '#14532d'); } } })] });

/* ===================== MONITORES ===================== */

function lcd(wd: number, ht: number, kind: Parameters<typeof screenPaint>[0], frame = '#16171c', curve = false): Prim[] {
  const x0 = 0.5 - wd / 2;
  const prims: Prim[] = [
    box(0.42, 0.2, 0, 0.16, 0.14, 0.03, frame),
    box(0.47, 0.22, 0.03, 0.06, 0.05, 0.16, frame),
    box(x0, 0.24, 0.16, wd, 0.05, ht, frame, { py: screenPaint(kind, 1.5, frame) }),
  ];
  if (curve) {
    prims.push(box(x0 - 0.1, 0.2, 0.16, 0.12, 0.06, ht, frame, { py: screenPaint(kind, 1, frame) }));
    prims.push(box(x0 + wd - 0.02, 0.2, 0.16, 0.12, 0.06, ht, frame, { py: screenPaint(kind, 1, frame) }));
  }
  return prims;
}
add({ id: 'monitor-tubo', name: 'Monitor de tubo', cat: 'monitores', price: 0, rarity: 'sucata', w: 1, d: 1, place: 'top', use: 'computer', model: () => [box(0.22, 0.12, 0, 0.56, 0.52, 0.42, PALETTE.yellowed, { py: screenPaint('crt', 4, PALETTE.yellowed) }), box(0.3, 0.05, 0.05, 0.4, 0.1, 0.3, shade(PALETTE.yellowed, -0.1))], sad: true });
add({ id: 'monitor-tubo-15', name: 'Monitor de tubo 15" (seminovo)', cat: 'monitores', price: 20, rarity: 'sucata', w: 1, d: 1, place: 'top', use: 'computer', model: () => [box(0.2, 0.12, 0, 0.6, 0.55, 0.45, '#d9d4c7', { py: screenPaint('code', 4, '#d9d4c7') }), box(0.3, 0.05, 0.05, 0.4, 0.1, 0.32, '#c8c2b3')] });
add({ id: 'monitor-lcd-pequeno', name: 'LCD pequeno', cat: 'monitores', price: 40, rarity: 'comum', w: 1, d: 1, place: 'top', use: 'computer', model: () => lcd(0.45, 0.32, 'code', '#2b2b2b') });
add({ id: 'monitor-19', name: 'Monitor 19 polegadas', cat: 'monitores', price: 75, rarity: 'comum', w: 1, d: 1, place: 'top', use: 'computer', model: () => lcd(0.58, 0.36, 'chart') });
variants(['black', 'white'], (c, n) => add({ id: `monitor-24-${n}`, name: `Monitor 24 polegadas (${COLOR_LABEL[n]})`, cat: 'monitores', price: 140, rarity: 'incomum', w: 1, d: 1, place: 'top', use: 'computer', model: () => lcd(0.72, 0.42, 'code', n === 'white' ? '#dcdce2' : '#16171c') }));
add({ id: 'monitor-27', name: 'Monitor 27 polegadas', cat: 'monitores', price: 260, rarity: 'incomum', w: 1, d: 1, place: 'top', use: 'computer', model: () => lcd(0.86, 0.48, 'finance') });
add({ id: 'monitor-ultrawide', name: 'Monitor ultrawide curvo', cat: 'monitores', price: 620, rarity: 'raro', w: 2, d: 1, place: 'top', use: 'computer', model: () => { const p = lcd(1.3, 0.45, 'game'); return p.map((b) => (b.t === 'box' ? { ...b, x: b.x + 0.5 } : b)); }, collection: 'gamer' });
add({ id: 'monitor-duplo', name: 'Dois monitores', cat: 'monitores', price: 380, rarity: 'raro', w: 2, d: 1, place: 'top', use: 'computer', model: () => [...lcd(0.8, 0.45, 'code').map((b) => ({ ...b, x: b.x + 0.1 } as Prim)), ...lcd(0.8, 0.45, 'chart').map((b) => ({ ...b, x: b.x + 0.95 } as Prim))] });
add({ id: 'monitor-triplo', name: 'Três monitores', cat: 'monitores', price: 900, rarity: 'epico', w: 3, d: 1, place: 'top', use: 'computer', model: () => [0, 1, 2].flatMap((i) => lcd(0.88, 0.48, (['finance', 'code', 'chart'] as const)[i]).map((b) => ({ ...b, x: b.x + i * 0.95 + 0.05 } as Prim))), minLevel: 7, collection: 'ceo' });
add({ id: 'monitor-parede', name: 'Parede de monitores (trader)', cat: 'monitores', price: 3200, rarity: 'lendario', w: 3, d: 1, place: 'floor', use: 'computer', minLevel: 14, collection: 'ceo', model: () => {
  const p: Prim[] = [box(0.1, 0.2, 0, 2.8, 0.3, 0.1, '#22242c'), box(1.4, 0.25, 0.1, 0.2, 0.2, 0.6, '#22242c')];
  const kinds = ['finance', 'chart', 'code', 'chart', 'finance', 'code', 'chart', 'finance', 'chart'] as const;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) p.push(box(0.12 + c * 0.93, 0.3, 0.7 + r * 0.55, 0.9, 0.06, 0.52, '#101114', { py: screenPaint(kinds[r * 3 + c], 1.5, '#101114') }));
  return p;
} });
add({ id: 'monitor-portatil', name: 'Monitor portátil', cat: 'monitores', price: 120, rarity: 'incomum', w: 1, d: 1, place: 'top', use: 'computer', model: () => [box(0.25, 0.3, 0, 0.5, 0.18, 0.03, '#333'), box(0.25, 0.28, 0.03, 0.5, 0.04, 0.3, '#333', { py: screenPaint('chart', 1, '#222') })] });
add({ id: 'monitor-rosa', name: 'Monitor 24" rosa', cat: 'monitores', price: 160, rarity: 'incomum', w: 1, d: 1, place: 'top', use: 'computer', model: () => lcd(0.72, 0.42, 'game', '#e58fbf'), collection: 'kawaii' });
add({ id: 'monitor-oled-49', name: 'Monitor OLED 49" super ultrawide', cat: 'monitores', price: 1900, rarity: 'epico', w: 2, d: 1, place: 'top', use: 'computer', minLevel: 10, model: () => lcd(1.7, 0.5, 'game', '#0a0a0a', false).map((b) => ({ ...b, x: b.x + 0.5 } as Prim)) });

/* ===================== CADEIRAS ===================== */

type ChairKind = 'stool' | 'plastic' | 'oldoffice' | 'padded' | 'gamer' | 'ergo' | 'exec' | 'lux' | 'folding' | 'bean';
function chairModel(kind: ChairKind, c: string, accent = '#111'): () => Prim[] {
  return () => {
    const seatZ = 0.42;
    switch (kind) {
      case 'stool':
        return [...legs4(0.3, 0.3, 0.4, 0.4, seatZ, shade(c, -0.15), 0.06), box(0.28, 0.28, seatZ, 0.44, 0.44, 0.06, c, { top: plankPaint(c, true) })];
      case 'plastic':
        return [...legs4(0.22, 0.22, 0.56, 0.56, seatZ, c, 0.07), box(0.2, 0.2, seatZ, 0.6, 0.6, 0.05, c), box(0.2, 0.14, seatZ + 0.05, 0.6, 0.08, 0.45, c, { my: stripesPaint(c, shade(c, -0.05), 3) }), box(0.18, 0.2, seatZ + 0.05, 0.06, 0.5, 0.18, c), box(0.76, 0.2, seatZ + 0.05, 0.06, 0.5, 0.18, c)];
      case 'folding':
        return [box(0.25, 0.25, 0, 0.05, 0.5, seatZ, '#777'), box(0.7, 0.25, 0, 0.05, 0.5, seatZ, '#777'), box(0.22, 0.22, seatZ, 0.56, 0.56, 0.04, c), box(0.22, 0.16, seatZ, 0.56, 0.06, 0.45, c)];
      case 'bean':
        return [box(0.12, 0.12, 0, 0.76, 0.76, 0.3, c, { top: cushionPaint(c, 1) }), box(0.14, 0.1, 0.25, 0.72, 0.25, 0.3, shade(c, -0.05))];
      case 'oldoffice':
      case 'padded':
      case 'gamer':
      case 'ergo':
      case 'exec':
      case 'lux': {
        const base = kind === 'lux' ? PALETTE.gold : kind === 'oldoffice' ? '#555' : '#2a2a2a';
        const p: Prim[] = [
          box(0.2, 0.46, 0, 0.6, 0.08, 0.05, base), box(0.46, 0.2, 0, 0.08, 0.6, 0.05, base),
          box(0.46, 0.46, 0.05, 0.08, 0.08, seatZ - 0.08, '#333'),
        ];
        const seat = kind === 'oldoffice' ? shade(c, -0.1) : c;
        p.push(box(0.18, 0.18, seatZ - 0.03, 0.64, 0.64, 0.1, seat, { top: kind === 'oldoffice' ? (ctx, w, h) => { rect(ctx, 0, 0, w, h, seat); rect(ctx, w * 0.3, h * 0.4, 6, 4, '#c9b48a'); } : cushionPaint(seat, 1) }));
        const backH = kind === 'gamer' || kind === 'lux' || kind === 'exec' ? 0.85 : kind === 'ergo' ? 0.75 : 0.55;
        const backPaint: Paint | undefined = kind === 'gamer'
          ? (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); rect(ctx, 0, 0, 3, h, accent); rect(ctx, w - 3, 0, 3, h, accent); rect(ctx, w / 2 - 4, 4, 8, 6, accent); }
          : kind === 'ergo' ? (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); ctx.fillStyle = shade(c, -0.25); for (let y = 2; y < h; y += 3) ctx.fillRect(1, y, w - 2, 1); }
            : kind === 'exec' || kind === 'lux' ? (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); ctx.fillStyle = shade(c, -0.2); for (let x = 4; x < w; x += 6) for (let y = 4; y < h; y += 6) ctx.fillRect(x, y, 1, 1); if (kind === 'lux') { rect(ctx, 0, 0, w, 2, PALETTE.gold); } }
              : undefined;
        p.push(box(0.2, 0.12, seatZ + 0.07, 0.6, 0.12, backH, c, { my: backPaint, py: backPaint }));
        if (kind === 'gamer' || kind === 'lux') p.push(box(0.3, 0.13, seatZ + 0.07 + backH, 0.4, 0.1, 0.12, kind === 'lux' ? PALETTE.gold : accent));
        if (kind !== 'oldoffice' && kind !== 'padded') {
          p.push(box(0.14, 0.25, seatZ + 0.1, 0.06, 0.45, 0.2, '#333'), box(0.8, 0.25, seatZ + 0.1, 0.06, 0.45, 0.2, '#333'));
        }
        return p;
      }
    }
  };
}
add({ id: 'cadeira-banquinho', name: 'Banquinho de madeira', cat: 'cadeiras', price: 8, rarity: 'sucata', w: 1, d: 1, place: 'floor', sit: 0.48, model: chairModel('stool', PALETTE.lightwood) });
add({ id: 'cadeira-plastico-branca', name: 'Cadeira de plástico branca', cat: 'cadeiras', price: 0, rarity: 'sucata', w: 1, d: 1, place: 'floor', sit: 0.47, model: chairModel('plastic', '#eeeeea'), sad: true, desc: 'Clássico de churrasco. Agora no seu "escritório".' });
variants(['red', 'blue', 'green', 'black'], (c, n) => add({ id: `cadeira-plastico-${n}`, name: `Cadeira de plástico (${COLOR_LABEL[n]})`, cat: 'cadeiras', price: 12, rarity: 'sucata', w: 1, d: 1, place: 'floor', sit: 0.47, model: chairModel('plastic', c) }));
add({ id: 'cadeira-dobravel', name: 'Cadeira dobrável', cat: 'cadeiras', price: 18, rarity: 'comum', w: 1, d: 1, place: 'floor', sit: 0.46, model: chairModel('folding', '#5d6472') });
add({ id: 'cadeira-escritorio-velha', name: 'Cadeira de escritório velha (rasgada)', cat: 'cadeiras', price: 25, rarity: 'comum', w: 1, d: 1, place: 'floor', sit: 0.49, model: chairModel('oldoffice', '#3d3f47') });
variants(['navy', 'gray', 'red'], (c, n) => add({ id: `cadeira-acolchoada-${n}`, name: `Cadeira acolchoada simples (${COLOR_LABEL[n]})`, cat: 'cadeiras', price: 60, rarity: 'comum', w: 1, d: 1, place: 'floor', sit: 0.49, model: chairModel('padded', c) }));
([['red', '#c0392b'], ['blue', '#2f6fd1'], ['pink', '#e86fb0'], ['green', '#2e9e5b'], ['white', '#e9e6df']] as const).forEach(([n, acc]) =>
  add({ id: `cadeira-gamer-${n}`, name: `Cadeira gamer básica (${COLOR_LABEL[n]})`, cat: 'cadeiras', price: 150, rarity: 'incomum', w: 1, d: 1, place: 'floor', sit: 0.49, model: chairModel('gamer', '#1d1e24', acc), collection: n === 'pink' ? 'kawaii' : 'gamer' }));
add({ id: 'cadeira-ergonomica', name: 'Cadeira ergonômica de tela', cat: 'cadeiras', price: 340, rarity: 'raro', w: 1, d: 1, place: 'floor', sit: 0.49, model: chairModel('ergo', '#30333b') });
variants(['black', 'darkwood'], (c, n) => add({ id: `cadeira-executiva-${n}`, name: `Cadeira executiva de couro (${COLOR_LABEL[n]})`, cat: 'cadeiras', price: 650, rarity: 'epico', w: 1, d: 1, place: 'floor', sit: 0.49, model: chairModel('exec', n === 'black' ? '#1c1c1f' : '#5a3520'), minLevel: 8, collection: 'ceo' }));
add({ id: 'cadeira-luxo', name: 'Cadeira premium de luxo (couro e ouro)', cat: 'cadeiras', price: 2800, rarity: 'lendario', w: 1, d: 1, place: 'floor', sit: 0.49, model: chairModel('lux', '#7a1f2b'), minLevel: 16, collection: 'imperio' });
variants(['orange', 'purple', 'teal'], (c, n) => add({ id: `puff-${n}`, name: `Puff pera (${COLOR_LABEL[n]})`, cat: 'cadeiras', price: 55, rarity: 'comum', w: 1, d: 1, place: 'floor', sit: 0.28, model: chairModel('bean', c) }));

/* ===================== MESAS ===================== */

type DeskKind = 'crate' | 'folding' | 'school' | 'wood' | 'office' | 'gamer' | 'standing' | 'glass' | 'exec' | 'future' | 'L';
function deskModel(kind: DeskKind, c: string, w = 2, d = 1): () => Prim[] {
  return () => {
    const H = 0.74;
    if (kind === 'crate') {
      const crate = (x: number) => box(x, 0.2, 0, 0.5, 0.6, 0.55, '#a77d4b', { py: plankPaint('#a77d4b'), px: plankPaint('#946c3e') });
      return [crate(0.1), crate(w - 0.6), box(0.02, 0.1, 0.55, w - 0.04, 0.8, 0.05, '#c4a06a', { top: (ctx, ww, hh) => { plankPaint('#c4a06a', true)(ctx, ww, hh, 0); rect(ctx, ww * 0.6, hh * 0.3, 8, 5, 'rgba(90,60,30,0.5)'); } })];
    }
    if (kind === 'folding') return [box(0.1, 0.15, 0, 0.05, 0.7, 0.68, '#888'), box(w - 0.15, 0.15, 0, 0.05, 0.7, 0.68, '#888'), box(0.05, 0.1, 0.68, w - 0.1, 0.8, 0.04, c)];
    if (kind === 'school') return [...legs4(0.1, 0.12, w - 0.2, 0.76, 0.7, '#5a5f6b', 0.05), box(0.05, 0.08, 0.7, w - 0.1, 0.84, 0.04, c), box(0.12, 0.14, 0.48, w - 0.24, 0.72, 0.03, '#5a5f6b')];
    if (kind === 'standing') return [box(0.15, 0.4, 0, 0.1, 0.3, 0.98, '#2b2b2b'), box(w - 0.25, 0.4, 0, 0.1, 0.3, 0.98, '#2b2b2b'), box(0.1, 0.35, 0, 0.2, 0.4, 0.03, '#2b2b2b'), box(w - 0.3, 0.35, 0, 0.2, 0.4, 0.03, '#2b2b2b'), box(0.03, 0.08, 0.98, w - 0.06, 0.84, 0.05, c)];
    if (kind === 'glass') return [...legs4(0.08, 0.1, w - 0.16, 0.8, H, '#c0c6d0', 0.05), box(0.03, 0.06, H, w - 0.06, 0.88, 0.03, 'rgba(170,220,255,0.55)', { outline: true })];
    if (kind === 'future') return [box(0.2, 0.3, 0, w - 0.4, 0.4, H - 0.05, '#0f1220', { py: (ctx, ww, hh, t) => { rect(ctx, 0, 0, ww, hh, '#0f1220'); rect(ctx, 0, hh * 0.5, ww, 2, hsl(190 + Math.sin(t) * 30, 100, 60)); } }), box(0.03, 0.06, H - 0.05, w - 0.06, 0.88, 0.05, '#e8f4ff', { py: (ctx, ww, hh, t) => { rect(ctx, 0, 0, ww, hh, hsl(190 + Math.sin(t) * 30, 100, 60)); } })];
    if (kind === 'L') {
      return [
        box(0.05, 0.05, 0, 0.5, 0.9, H - 0.04, c, { py: drawersPaint(3, c), px: drawersPaint(3, c) }),
        box(w - 0.55, 0.05, 0, 0.5, 0.9, H - 0.04, c),
        box(w - 0.95, d - 0.95, 0, 0.9, 0.5, H - 0.04, c, { py: drawersPaint(2, c) }),
        box(0, 0, H - 0.04, w, 1, 0.05, shade(c, 0.1)),
        box(w - 1, 1, H - 0.04, 1, d - 1, 0.05, shade(c, 0.1)),
      ];
    }
    const top = kind === 'exec' ? shade(c, 0.05) : c;
    const p: Prim[] = [];
    if (kind === 'wood') p.push(...legs4(0.06, 0.08, w - 0.12, 0.84, H - 0.05, shade(c, -0.15), 0.08));
    if (kind === 'office') { p.push(box(0.06, 0.08, 0, 0.5, 0.84, H - 0.05, c, { py: drawersPaint(3, c) })); p.push(box(w - 0.12, 0.08, 0, 0.06, 0.84, H - 0.05, '#666')); }
    if (kind === 'gamer') { p.push(box(0.1, 0.3, 0, 0.12, 0.4, H - 0.05, '#1a1a1a'), box(w - 0.22, 0.3, 0, 0.12, 0.4, H - 0.05, '#1a1a1a')); }
    if (kind === 'exec') p.push(box(0.05, 0.08, 0, w - 0.1, 0.84, H - 0.05, c, { py: (ctx, ww, hh) => { rect(ctx, 0, 0, ww, hh, c); rect(ctx, 3, 3, ww - 6, hh - 6, shade(c, -0.12)); rect(ctx, 6, 6, ww - 12, 1, PALETTE.gold); } }));
    p.push(box(0.02, 0.04, H - 0.05, w - 0.04, 0.92, 0.05, top, {
      py: kind === 'gamer' ? (ctx, ww, hh, t) => { rect(ctx, 0, 0, ww, hh, '#111'); rect(ctx, 0, hh - 1, ww, 1, hsl(t * 90, 100, 60)); } : undefined,
      top: kind === 'gamer' ? (ctx, ww, hh) => { rect(ctx, 0, 0, ww, hh, '#1c1c22'); rect(ctx, 4, 4, ww - 8, hh - 8, '#262630'); } : undefined,
    }));
    return p;
  };
}
add({ id: 'mesa-improvisada', name: 'Mesa improvisada (caixotes + tábua)', cat: 'mesas', price: 0, rarity: 'sucata', w: 2, d: 1, place: 'floor', surface: 0.6, model: deskModel('crate', '#a77d4b'), sad: true });
add({ id: 'mesa-dobravel', name: 'Mesinha dobrável', cat: 'mesas', price: 25, rarity: 'comum', w: 2, d: 1, place: 'floor', surface: 0.72, model: deskModel('folding', '#d8d4cc') });
add({ id: 'mesa-escolar', name: 'Mesa escolar reaproveitada', cat: 'mesas', price: 35, rarity: 'comum', w: 2, d: 1, place: 'floor', surface: 0.74, model: deskModel('school', '#d9b98a') });
variants(['wood', 'lightwood', 'darkwood', 'white', 'black'], (c, n) => add({ id: `mesa-madeira-${n}`, name: `Escrivaninha (${COLOR_LABEL[n]})`, cat: 'mesas', price: 70, rarity: 'comum', w: 2, d: 1, place: 'floor', surface: 0.74, model: deskModel('wood', c) }));
variants(['gray', 'white', 'wood'], (c, n) => add({ id: `mesa-escritorio-${n}`, name: `Mesa de escritório com gaveteiro (${COLOR_LABEL[n]})`, cat: 'mesas', price: 140, rarity: 'incomum', w: 2, d: 1, place: 'floor', surface: 0.74, model: deskModel('office', c) }));
add({ id: 'mesa-gamer', name: 'Mesa gamer com LED', cat: 'mesas', price: 260, rarity: 'raro', w: 2, d: 1, place: 'floor', surface: 0.74, model: deskModel('gamer', '#1a1a1a'), collection: 'gamer' });
add({ id: 'mesa-gamer-3', name: 'Mesa gamer larga (3 lugares)', cat: 'mesas', price: 420, rarity: 'raro', w: 3, d: 1, place: 'floor', surface: 0.74, model: deskModel('gamer', '#1a1a1a', 3) });
add({ id: 'mesa-l', name: 'Mesa em L', cat: 'mesas', price: 380, rarity: 'raro', w: 2, d: 2, place: 'floor', surface: 0.74, model: deskModel('L', '#b98a56', 2, 2) });
add({ id: 'mesa-standing', name: 'Standing desk elétrica', cat: 'mesas', price: 560, rarity: 'raro', w: 2, d: 1, place: 'floor', surface: 1.0, model: deskModel('standing', '#c99b65') });
add({ id: 'mesa-vidro', name: 'Mesa de vidro', cat: 'mesas', price: 480, rarity: 'raro', w: 2, d: 1, place: 'floor', surface: 0.76, model: deskModel('glass', '#aaa') });
add({ id: 'mesa-executiva', name: 'Mesa executiva de mogno', cat: 'mesas', price: 1400, rarity: 'epico', w: 3, d: 1, place: 'floor', surface: 0.74, model: deskModel('exec', PALETTE.mahogany, 3), minLevel: 10, collection: 'ceo' });
add({ id: 'mesa-futurista', name: 'Mesa futurista holográfica', cat: 'mesas', price: 3600, rarity: 'lendario', w: 3, d: 1, place: 'floor', surface: 0.74, model: deskModel('future', '#0f1220', 3), minLevel: 15, collection: 'futuro' });
add({ id: 'mesa-centro', name: 'Mesinha de centro', cat: 'mesas', price: 50, rarity: 'comum', w: 1, d: 1, place: 'floor', surface: 0.4, model: () => [...legs4(0.15, 0.15, 0.7, 0.7, 0.36, PALETTE.darkwood), box(0.1, 0.1, 0.36, 0.8, 0.8, 0.05, PALETTE.wood)] });
add({ id: 'mesa-centro-vidro', name: 'Mesa de centro de vidro', cat: 'mesas', price: 160, rarity: 'incomum', w: 2, d: 1, place: 'floor', surface: 0.4, model: () => [...legs4(0.15, 0.15, 1.7, 0.7, 0.36, '#c0c6d0'), box(0.1, 0.1, 0.36, 1.8, 0.8, 0.03, 'rgba(170,220,255,0.55)')] });
add({ id: 'criado-mudo', name: 'Criado-mudo', cat: 'mesas', price: 40, rarity: 'comum', w: 1, d: 1, place: 'floor', surface: 0.5, model: () => [box(0.15, 0.15, 0, 0.7, 0.7, 0.5, PALETTE.wood, { py: drawersPaint(2, PALETTE.wood) })] });
add({ id: 'mesa-redonda', name: 'Mesa redonda de bistrô', cat: 'mesas', price: 90, rarity: 'incomum', w: 1, d: 1, place: 'floor', surface: 0.72, model: () => [box(0.42, 0.42, 0, 0.16, 0.16, 0.7, '#333'), box(0.3, 0.3, 0, 0.4, 0.4, 0.03, '#333'), box(0.1, 0.1, 0.7, 0.8, 0.8, 0.04, '#f2efe8')] });
add({ id: 'mesa-reuniao', name: 'Mesa de reunião (6 lugares)', cat: 'mesas', price: 900, rarity: 'epico', w: 4, d: 2, place: 'floor', surface: 0.74, minLevel: 9, model: () => [box(0.6, 0.6, 0, 0.3, 0.8, 0.7, '#333'), box(3.1, 0.6, 0, 0.3, 0.8, 0.7, '#333'), box(0.05, 0.1, 0.7, 3.9, 1.8, 0.06, PALETTE.darkwood, { top: (ctx, w, h) => { rect(ctx, 0, 0, w, h, PALETTE.darkwood); rect(ctx, 6, 6, w - 12, h - 12, shade(PALETTE.darkwood, 0.08)); } })] });

/* ===================== PERIFÉRICOS ===================== */

const kb = (c: string, rgb: boolean, w = 0.6, x = 0.18): () => Prim[] => () => [box(x, 0.55, 0, w, 0.2, 0.035, c, { top: keysPaint(c, rgb) })];
add({ id: 'teclado-velho', name: 'Teclado velho (tecla Ç faltando)', cat: 'perifericos', price: 0, rarity: 'sucata', w: 1, d: 1, place: 'top', model: kb('#cfc5a5', false), sad: true });
add({ id: 'teclado-basico', name: 'Teclado básico', cat: 'perifericos', price: 10, rarity: 'comum', w: 1, d: 1, place: 'top', model: kb('#2a2a2e', false) });
add({ id: 'teclado-branco', name: 'Teclado branco slim', cat: 'perifericos', price: 22, rarity: 'comum', w: 1, d: 1, place: 'top', model: kb('#e8e8ec', false) });
add({ id: 'teclado-mecanico', name: 'Teclado mecânico', cat: 'perifericos', price: 70, rarity: 'incomum', w: 1, d: 1, place: 'top', model: kb('#3a3d47', false) });
add({ id: 'teclado-rgb', name: 'Teclado mecânico RGB', cat: 'perifericos', price: 120, rarity: 'raro', w: 1, d: 1, place: 'top', model: kb('#1a1a1f', true), collection: 'rgb' });
add({ id: 'teclado-60', name: 'Teclado 60% artesanal', cat: 'perifericos', price: 210, rarity: 'raro', w: 1, d: 1, place: 'top', model: kb('#f4c2d7', false, 0.42, 0.25), collection: 'kawaii' });
add({ id: 'teclado-ouro', name: 'Teclado banhado a ouro', cat: 'perifericos', price: 1500, rarity: 'lendario', w: 1, d: 1, place: 'top', model: kb(PALETTE.gold, false), collection: 'imperio', minLevel: 12 });
const mouse = (c: string, rgb = false): () => Prim[] => () => [box(0.78, 0.58, 0, 0.1, 0.14, 0.04, c, { top: rgb ? (ctx, w, h, t) => { rect(ctx, 0, 0, w, h, c); rect(ctx, w / 2 - 1, 1, 2, h - 2, hsl(t * 120, 90, 60)); } : undefined })];
add({ id: 'mouse-bolinha', name: 'Mouse de bolinha', cat: 'perifericos', price: 0, rarity: 'sucata', w: 1, d: 1, place: 'top', model: mouse('#cfc5a5'), sad: true });
add({ id: 'mouse-basico', name: 'Mouse óptico básico', cat: 'perifericos', price: 8, rarity: 'comum', w: 1, d: 1, place: 'top', model: mouse('#2a2a2e') });
add({ id: 'mouse-sem-fio', name: 'Mouse sem fio', cat: 'perifericos', price: 30, rarity: 'comum', w: 1, d: 1, place: 'top', model: mouse('#c8ccd4') });
add({ id: 'mouse-gamer', name: 'Mouse gamer RGB', cat: 'perifericos', price: 75, rarity: 'incomum', w: 1, d: 1, place: 'top', model: mouse('#151518', true), collection: 'rgb' });
add({ id: 'mouse-vertical', name: 'Mouse vertical ergonômico', cat: 'perifericos', price: 95, rarity: 'incomum', w: 1, d: 1, place: 'top', model: () => [box(0.78, 0.58, 0, 0.1, 0.14, 0.09, '#333')] });
const pad = (c: string, b: string, big = false, rgb = false): () => Prim[] => () => [box(big ? 0.05 : 0.68, big ? 0.5 : 0.52, 0, big ? 0.9 : 0.28, big ? 0.32 : 0.24, 0.01, c, { outline: false, top: rgb ? (ctx, w, h, t) => { rect(ctx, 0, 0, w, h, c); ctx.strokeStyle = hsl(t * 90, 100, 60); ctx.strokeRect(1, 1, w - 2, h - 2); } : (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); rect(ctx, 2, 2, 4, 4, b); } })];
add({ id: 'mousepad-simples', name: 'Mousepad de propaganda', cat: 'perifericos', price: 5, rarity: 'sucata', w: 1, d: 1, place: 'top', model: pad('#2d5fa6', '#fff') });
add({ id: 'mousepad-preto', name: 'Mousepad preto', cat: 'perifericos', price: 10, rarity: 'comum', w: 1, d: 1, place: 'top', model: pad('#222', '#444') });
add({ id: 'mousepad-anime', name: 'Mousepad estampado', cat: 'perifericos', price: 25, rarity: 'comum', w: 1, d: 1, place: 'top', model: pad('#f5b7d1', '#7a3a5e'), collection: 'kawaii' });
add({ id: 'deskpad-grande', name: 'Deskpad grande', cat: 'perifericos', price: 45, rarity: 'incomum', w: 1, d: 1, place: 'top', model: pad('#2b2e38', '#555', true) });
add({ id: 'deskpad-rgb', name: 'Deskpad RGB', cat: 'perifericos', price: 90, rarity: 'raro', w: 1, d: 1, place: 'top', model: pad('#111', '#555', true, true), collection: 'rgb' });
add({ id: 'deskpad-couro', name: 'Deskpad de couro', cat: 'perifericos', price: 160, rarity: 'raro', w: 1, d: 1, place: 'top', model: pad('#6b3d22', '#d9b25a', true), collection: 'ceo' });
const headset = (c: string, acc: string, stand = false): () => Prim[] => () => [
  ...(stand ? [box(0.15, 0.25, 0, 0.2, 0.2, 0.02, '#222'), box(0.23, 0.33, 0.02, 0.04, 0.04, 0.35, '#222')] : []),
  box(0.12, 0.3, stand ? 0.2 : 0, 0.08, 0.14, 0.16, c, { py: (ctx, w, h) => rect(ctx, 1, 1, w - 2, h - 2, acc) }),
  box(0.3, 0.3, stand ? 0.2 : 0, 0.08, 0.14, 0.16, c),
  box(0.12, 0.33, stand ? 0.36 : 0.16, 0.26, 0.08, 0.04, c),
];
add({ id: 'fone-ouvido', name: 'Fone de ouvido com fio embolado', cat: 'audio', price: 5, rarity: 'sucata', w: 1, d: 1, place: 'top', model: () => [box(0.2, 0.6, 0, 0.12, 0.12, 0.02, '#eee'), box(0.35, 0.65, 0, 0.12, 0.08, 0.02, '#eee')] });
add({ id: 'headset-basico', name: 'Headset básico', cat: 'audio', price: 25, rarity: 'comum', w: 1, d: 1, place: 'top', model: headset('#2a2a2e', '#555') });
add({ id: 'headset-gamer', name: 'Headset gamer', cat: 'audio', price: 80, rarity: 'incomum', w: 1, d: 1, place: 'top', model: headset('#1a1a1a', '#e53935', true), collection: 'gamer' });
add({ id: 'headset-branco', name: 'Headset branco com orelhinhas', cat: 'audio', price: 95, rarity: 'incomum', w: 1, d: 1, place: 'top', model: headset('#f2f2f2', '#f6a5c0', true), collection: 'kawaii' });
add({ id: 'headset-estudio', name: 'Headphone de estúdio', cat: 'audio', price: 260, rarity: 'raro', w: 1, d: 1, place: 'top', model: headset('#2b2b2b', '#9aa', true) });
const mic = (c: string, arm = false): () => Prim[] => () => arm
  ? [box(0.1, 0.1, 0, 0.1, 0.1, 0.05, '#222'), box(0.12, 0.12, 0.05, 0.05, 0.05, 0.55, '#333'), box(0.12, 0.12, 0.6, 0.45, 0.05, 0.05, '#333'), box(0.5, 0.1, 0.4, 0.1, 0.1, 0.22, c, { py: stripesPaint(c, shade(c, -0.3), 1) })]
  : [box(0.15, 0.2, 0, 0.16, 0.16, 0.03, '#222'), box(0.21, 0.26, 0.03, 0.04, 0.04, 0.12, '#333'), box(0.18, 0.23, 0.15, 0.1, 0.1, 0.18, c, { py: stripesPaint(c, shade(c, -0.3), 1) })];
add({ id: 'mic-basico', name: 'Microfone de mesa básico', cat: 'audio', price: 30, rarity: 'comum', w: 1, d: 1, place: 'top', model: mic('#3a3a3a') });
add({ id: 'mic-usb', name: 'Microfone USB condensador', cat: 'audio', price: 110, rarity: 'incomum', w: 1, d: 1, place: 'top', model: mic('#b0b6c2') });
add({ id: 'mic-braco', name: 'Microfone com braço articulado', cat: 'audio', price: 240, rarity: 'raro', w: 1, d: 1, place: 'top', model: mic('#202020', true) });
add({ id: 'mic-podcast', name: 'Kit podcast profissional', cat: 'audio', price: 520, rarity: 'epico', w: 1, d: 1, place: 'top', model: mic('#c9a227', true), minLevel: 9 });
const cam = (c: string, ring = false): () => Prim[] => () => [box(0.42, 0.2, 0, 0.16, 0.12, 0.03, '#222'), box(0.48, 0.22, 0.03, 0.04, 0.04, 0.5, '#222'), box(0.4, 0.2, 0.53, 0.2, 0.08, 0.08, c, { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); rect(ctx, w / 2 - 2, h / 2 - 2, 4, 4, '#4aa3ff'); } }), ...(ring ? [spr(0.5, 0.24, 0.9, (ctx) => { ctx.strokeStyle = '#fffbe6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 9, 9, 0, 0, 7); ctx.stroke(); }, 0.2, 0.3)] : [])];
add({ id: 'webcam-basica', name: 'Webcam básica', cat: 'audio', price: 20, rarity: 'comum', w: 1, d: 1, place: 'top', model: () => [box(0.42, 0.2, 0, 0.16, 0.1, 0.08, '#222', { py: (ctx, w, h) => rect(ctx, w / 2 - 2, h / 2 - 2, 4, 4, '#4aa3ff') })] });
add({ id: 'webcam-hd', name: 'Webcam Full HD em tripé', cat: 'audio', price: 90, rarity: 'incomum', w: 1, d: 1, place: 'top', model: cam('#333') });
add({ id: 'webcam-ringlight', name: 'Webcam 4K + ring light', cat: 'audio', price: 280, rarity: 'raro', w: 1, d: 1, place: 'top', model: cam('#222', true), light: { color: '#fffbe6', r: 2.2, z: 1 } });
add({ id: 'camera-streamer', name: 'Câmera de streamer', cat: 'audio', price: 900, rarity: 'epico', w: 1, d: 1, place: 'floor', model: () => [box(0.3, 0.3, 0, 0.4, 0.4, 0.03, '#222'), box(0.48, 0.48, 0, 0.04, 0.04, 1.3, '#222'), box(0.35, 0.4, 1.3, 0.3, 0.2, 0.2, '#111', { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#111'); ctx.fillStyle = '#334'; ctx.beginPath(); ctx.arc(w / 2, h / 2, h * 0.4, 0, 7); ctx.fill(); } })] });
const speaker = (c: string, tall = false, rgb = false): () => Prim[] => () => {
  const h = tall ? 1.0 : 0.22;
  const sp = (x: number) => box(x, 0.25, 0, tall ? 0.3 : 0.14, tall ? 0.3 : 0.14, h, c, { py: (ctx, w, hh, t) => { rect(ctx, 0, 0, w, hh, c); ctx.fillStyle = rgb ? hsl(t * 100, 90, 55) : shade(c, -0.4); const r = Math.min(w, hh / (tall ? 3 : 1.6)) * 0.35; ctx.beginPath(); ctx.arc(w / 2, hh * 0.65, r, 0, 7); ctx.fill(); if (tall) { ctx.beginPath(); ctx.arc(w / 2, hh * 0.25, r * 0.6, 0, 7); ctx.fill(); } } });
  return tall ? [sp(0.35)] : [sp(0.08), sp(0.78)];
};
add({ id: 'caixa-som-pc', name: 'Caixinhas de som de PC', cat: 'audio', price: 15, rarity: 'comum', w: 1, d: 1, place: 'top', use: 'music', model: speaker('#2a2a2a') });
add({ id: 'caixa-som-bege', name: 'Caixinhas de som bege (anos 2000)', cat: 'audio', price: 6, rarity: 'sucata', w: 1, d: 1, place: 'top', use: 'music', model: speaker('#cfc5a5') });
add({ id: 'caixa-som-rgb', name: 'Caixas de som RGB', cat: 'audio', price: 90, rarity: 'incomum', w: 1, d: 1, place: 'top', use: 'music', model: speaker('#151515', false, true), collection: 'rgb' });
add({ id: 'caixa-som-torre', name: 'Caixa de som torre', cat: 'audio', price: 240, rarity: 'raro', w: 1, d: 1, place: 'floor', use: 'music', model: speaker('#3b2a1e', true) });
add({ id: 'caixa-som-torre-led', name: 'Caixa amplificada com LED', cat: 'audio', price: 380, rarity: 'raro', w: 1, d: 1, place: 'floor', use: 'music', model: speaker('#111', true, true) });
add({ id: 'vitrola', name: 'Vitrola retrô', cat: 'audio', price: 420, rarity: 'epico', w: 1, d: 1, place: 'top', use: 'music', model: () => [box(0.15, 0.2, 0, 0.7, 0.6, 0.18, PALETTE.darkwood, { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, PALETTE.darkwood); rect(ctx, 4, 3, w - 8, h - 6, '#c9a46a'); } }), spr(0.5, 0.5, 0.18, (ctx, t) => { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 4.5, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#c33'; ctx.fillRect(-1 + Math.cos(t * 5), -1, 2, 2); }, 0.3, 0.05)] });

/* ===================== ILUMINAÇÃO ===================== */

add({ id: 'lampada-pendurada', name: 'Lâmpada pendurada no fio', cat: 'iluminacao', price: 0, rarity: 'sucata', w: 1, d: 1, place: 'rug', fixture: false, sad: true, light: { color: '#ffd98a', r: 3.2, z: 2.2 }, model: () => [spr(0.5, 0.5, 2.2, (ctx, t) => { const sway = Math.sin(t * 0.9) * 1.5; ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(sway, -4); ctx.stroke(); ctx.fillStyle = '#555'; ctx.fillRect(sway - 2, -5, 4, 3); ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.ellipse(sway, 0, 3.5, 4, 0, 0, 7); ctx.fill(); }, 0.1, 0.4)], desc: 'Pisca quando bate um vento.' });
const deskLamp = (c: string, kind: 'basic' | 'arm' | 'led' | 'lava' | 'neon'): () => Prim[] => () => {
  if (kind === 'lava') return [box(0.42, 0.42, 0, 0.16, 0.16, 0.08, '#c0c0c0'), spr(0.5, 0.5, 0.08, (ctx, t) => { ctx.fillStyle = 'rgba(255,120,200,0.55)'; ctx.fillRect(-3, -14, 6, 14); ctx.fillStyle = '#ff4fa3'; ctx.beginPath(); ctx.arc(0, -4 - Math.abs(Math.sin(t)) * 8, 2, 0, 7); ctx.fill(); ctx.fillStyle = '#c0c0c0'; ctx.fillRect(-2, -17, 4, 3); }, 0.1, 0.45)];
  if (kind === 'neon') return [spr(0.5, 0.5, 0, (ctx, t) => { ctx.strokeStyle = hsl(300 + Math.sin(t * 2) * 20, 100, 65); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -10, 7, 0.3, Math.PI * 2 - 0.3); ctx.stroke(); ctx.fillStyle = '#222'; ctx.fillRect(-6, -2, 12, 2); }, 0.2, 0.5)];
  return [
    box(0.12, 0.2, 0, 0.18, 0.18, 0.03, c),
    box(0.19, 0.27, 0.03, 0.04, 0.04, kind === 'arm' ? 0.35 : 0.25, c),
    kind === 'led' ? box(0.18, 0.25, 0.3, 0.5, 0.08, 0.03, c) : box(0.12, 0.22, kind === 'arm' ? 0.34 : 0.24, 0.2, 0.18, 0.1, c, { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); rect(ctx, 2, h - 2, w - 4, 2, '#fff2b0'); } }),
  ];
};
add({ id: 'luminaria-mesa', name: 'Luminária de mesa simples', cat: 'iluminacao', price: 18, rarity: 'comum', w: 1, d: 1, place: 'top', light: { color: '#ffe4a3', r: 1.8, z: 1 }, model: deskLamp('#3a3a3a', 'basic') });
variants(['red', 'blue', 'white'], (c, n) => add({ id: `luminaria-articulada-${n}`, name: `Luminária articulada (${COLOR_LABEL[n]})`, cat: 'iluminacao', price: 45, rarity: 'comum', w: 1, d: 1, place: 'top', light: { color: '#fff0c2', r: 2, z: 1 }, model: deskLamp(c, 'arm') }));
add({ id: 'luminaria-led', name: 'Barra de LED para monitor', cat: 'iluminacao', price: 85, rarity: 'incomum', w: 1, d: 1, place: 'top', light: { color: '#e9f3ff', r: 2, z: 1 }, model: deskLamp('#222', 'led') });
add({ id: 'luminaria-lava', name: 'Lâmpada de lava', cat: 'iluminacao', price: 120, rarity: 'raro', w: 1, d: 1, place: 'top', light: { color: '#ff6fbf', r: 2, z: 0.8 }, model: deskLamp('#c0c0c0', 'lava'), collection: 'kawaii' });
add({ id: 'neon-anel', name: 'Neon de mesa', cat: 'iluminacao', price: 140, rarity: 'raro', w: 1, d: 1, place: 'top', light: { color: '#ff4fe0', r: 2.4, z: 0.8 }, model: deskLamp('#222', 'neon'), collection: 'rgb' });
const floorLamp = (c: string, shadeC: string, kind: 'basic' | 'arc' | 'tripod' | 'paper'): () => Prim[] => () => {
  if (kind === 'arc') return [box(0.1, 0.1, 0, 0.3, 0.3, 0.08, '#555'), box(0.22, 0.22, 0.08, 0.05, 0.05, 1.7, c), box(0.22, 0.22, 1.75, 0.6, 0.05, 0.05, c), box(0.62, 0.15, 1.45, 0.3, 0.25, 0.25, shadeC)];
  if (kind === 'paper') return [box(0.4, 0.4, 0, 0.2, 0.2, 0.05, '#333'), box(0.3, 0.3, 0.05, 0.4, 0.4, 1.2, shadeC, { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, shadeC); ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 4; y < h; y += 6) ctx.fillRect(0, y, w, 1); }, px: (ctx, w, h) => { rect(ctx, 0, 0, w, h, shade(shadeC, -0.1)); } })];
  if (kind === 'tripod') return [box(0.25, 0.48, 0, 0.5, 0.04, 0.05, c), box(0.48, 0.25, 0, 0.04, 0.5, 0.05, c), box(0.47, 0.47, 0, 0.06, 0.06, 1.4, c), box(0.3, 0.3, 1.35, 0.4, 0.4, 0.35, shadeC)];
  return [box(0.35, 0.35, 0, 0.3, 0.3, 0.05, '#444'), box(0.47, 0.47, 0.05, 0.06, 0.06, 1.35, c), box(0.3, 0.3, 1.35, 0.4, 0.4, 0.3, shadeC)];
};
add({ id: 'abajur-chao', name: 'Abajur de chão', cat: 'iluminacao', price: 60, rarity: 'comum', w: 1, d: 1, place: 'floor', light: { color: '#ffd98a', r: 2.8, z: 1.5 }, model: floorLamp('#555', '#f1e3c0', 'basic') });
add({ id: 'luminaria-tripe', name: 'Luminária tripé', cat: 'iluminacao', price: 140, rarity: 'incomum', w: 1, d: 1, place: 'floor', light: { color: '#ffe1a6', r: 3, z: 1.6 }, model: floorLamp(PALETTE.darkwood, '#2d2d2d', 'tripod') });
add({ id: 'luminaria-arco', name: 'Luminária de arco', cat: 'iluminacao', price: 300, rarity: 'raro', w: 1, d: 1, place: 'floor', light: { color: '#fff3d6', r: 3.4, z: 1.7, x: 0.8, y: 0.3 }, model: floorLamp('#c0c0c0', '#e5e5e5', 'arc') });
add({ id: 'luminaria-papel', name: 'Luminária de papel japonesa', cat: 'iluminacao', price: 180, rarity: 'incomum', w: 1, d: 1, place: 'floor', light: { color: '#ffe6b0', r: 3, z: 0.8 }, model: floorLamp('#333', '#f6efe0', 'paper') });
add({ id: 'fita-led', name: 'Fita de LED no chão', cat: 'iluminacao', price: 70, rarity: 'incomum', w: 2, d: 1, place: 'rug', light: { color: '#7a5cff', r: 2.6, z: 0.1, x: 1 }, model: () => [box(0.05, 0.05, 0, 1.9, 0.05, 0.02, '#7a5cff', { outline: false, top: (ctx, w, h, t) => rect(ctx, 0, 0, w, h, hsl(t * 60, 100, 65)) })], collection: 'rgb' });
add({ id: 'lustre-cristal', name: 'Lustre de cristal', cat: 'iluminacao', price: 2400, rarity: 'lendario', w: 1, d: 1, place: 'rug', minLevel: 14, collection: 'imperio', light: { color: '#fff4d1', r: 4.5, z: 2.4 }, model: () => [spr(0.5, 0.5, 2.3, (ctx, t) => { ctx.strokeStyle = '#d4af37'; ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -10); ctx.stroke(); ctx.fillStyle = '#d4af37'; ctx.fillRect(-12, -10, 24, 3); for (let i = 0; i < 7; i++) { ctx.fillStyle = Math.sin(t * 3 + i) > 0.6 ? '#ffffff' : '#cfe8ff'; ctx.fillRect(-11 + i * 3.5, -7 + (i % 2) * 3, 2, 6); } }, 0.2, 0.6)] });

/* ===================== TAPETES ===================== */

const rug = (w: number, d: number, p: Paint): () => Prim[] => () => [box(0.05, 0.05, 0, w - 0.1, d - 0.1, 0.02, '#000', { outline: false, top: p })];
add({ id: 'fios-chao', name: 'Fios espalhados', cat: 'tapetes', price: 0, rarity: 'sucata', w: 2, d: 2, place: 'rug', sad: true, desc: 'Ninguém sabe o que liga onde.', model: () => [spr(1, 1, 0, (ctx) => { ctx.strokeStyle = '#151515'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-40, -8); ctx.bezierCurveTo(-20, 10, 0, -14, 14, 6); ctx.bezierCurveTo(24, 18, 30, 0, 40, 8); ctx.stroke(); ctx.strokeStyle = '#e8e8e8'; ctx.beginPath(); ctx.moveTo(-30, 10); ctx.bezierCurveTo(-10, -6, 6, 16, 30, -4); ctx.stroke(); ctx.fillStyle = '#ddd'; ctx.fillRect(-6, 2, 8, 4); ctx.fillStyle = '#222'; ctx.fillRect(-5, 3, 2, 2); }, 0.1, 0.02)] });
add({ id: 'tapete-capacho', name: 'Capacho "Bem-vindo"', cat: 'tapetes', price: 5, rarity: 'sucata', w: 1, d: 1, place: 'rug', model: rug(1, 1, (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#8b6b3e'); ctx.fillStyle = '#5a4424'; ctx.font = '7px monospace'; ctx.fillText('BEM', 6, h / 2 + 2); }) });
const rugColors: [string, string, string][] = [['vermelho', '#a83232', '#e8c26b'], ['azul', '#2c4f8f', '#a8c5ff'], ['verde', '#2f6b45', '#cde8a0'], ['bege', '#cbb38a', '#8c6d45'], ['cinza', '#6f7480', '#d5d7dd'], ['rosa', '#e7a1bf', '#fff'], ['roxo', '#5b3f8c', '#d9c4ff'], ['laranja', '#d9772b', '#ffe0b0']];
const rugKinds: { k: Parameters<typeof rugPaint>[0]; n: string; w: number; d: number; price: number; r: Rarity }[] = [
  { k: 'plain', n: 'Tapete liso', w: 2, d: 2, price: 20, r: 'comum' },
  { k: 'border', n: 'Tapete com borda', w: 2, d: 3, price: 40, r: 'comum' },
  { k: 'stripes', n: 'Tapete listrado', w: 3, d: 2, price: 55, r: 'incomum' },
  { k: 'circle', n: 'Tapete redondo', w: 2, d: 2, price: 50, r: 'incomum' },
  { k: 'shaggy', n: 'Tapete felpudo', w: 2, d: 2, price: 80, r: 'incomum' },
  { k: 'checker', n: 'Tapete xadrez', w: 3, d: 3, price: 95, r: 'raro' },
  { k: 'persian', n: 'Tapete persa', w: 3, d: 2, price: 320, r: 'epico' },
];
rugKinds.forEach((rk, i) => rugColors.forEach(([cn, a, b], j) => {
  if ((i + j) % 2 === 1 && rk.k !== 'plain') return; // controla a quantidade
  add({ id: `tapete-${rk.k}-${j}`, name: `${rk.n} (${cn})`, cat: 'tapetes', price: rk.price, rarity: rk.r, w: rk.w, d: rk.d, place: 'rug', model: rug(rk.w, rk.d, rugPaint(rk.k, a, b)), collection: rk.k === 'persian' ? 'imperio' : undefined });
}));
add({ id: 'tapete-gamer', name: 'Tapete gamer RGB', cat: 'tapetes', price: 150, rarity: 'raro', w: 2, d: 2, place: 'rug', model: rug(2, 2, rugPaint('gamer', '#16161f', '#e33')), collection: 'rgb' });
add({ id: 'tapete-cifrao', name: 'Tapete cifrão', cat: 'tapetes', price: 450, rarity: 'epico', w: 2, d: 2, place: 'rug', model: rug(2, 2, rugPaint('money', '#1f5a3a', '#e2b53f')), collection: 'imperio' });
add({ id: 'tapete-vermelho', name: 'Tapete vermelho de gala', cat: 'tapetes', price: 900, rarity: 'epico', w: 1, d: 4, place: 'rug', model: rug(1, 4, rugPaint('border', '#9b111e', '#e2b53f')), minLevel: 12 });

/* ===================== CAMAS ===================== */

const pillow = (x: number, y: number, z: number, w = 0.35, d = 0.5) => box(x, y, z, w, d, 0.1, '#f4f1ea');
function bedModel(kind: 'floor' | 'single' | 'box' | 'double' | 'king' | 'bunk' | 'gamer' | 'round', sheet: string, frame: string): () => Prim[] {
  return () => {
    if (kind === 'floor') return [box(0.05, 0.1, 0, 1.9, 0.8, 0.14, '#d8d2c0', { top: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#d8d2c0'); rect(ctx, w * 0.55, h * 0.3, 14, 9, 'rgba(160,130,70,0.45)'); rect(ctx, w * 0.2, h * 0.6, 8, 5, 'rgba(160,130,70,0.35)'); }, py: stripesPaint('#d8d2c0', '#c9c2ad', 3) }), box(0.1, 0.2, 0.14, 0.32, 0.55, 0.06, '#eee8da'), box(0.9, 0.12, 0.14, 1.0, 0.76, 0.03, sheet, { outline: false })];
    const H = kind === 'box' ? 0.45 : kind === 'bunk' ? 0.25 : 0.3;
    const D = kind === 'double' || kind === 'king' || kind === 'round' ? 2 : 1;
    const W = kind === 'king' ? 3 : 2;
    const p: Prim[] = [];
    if (kind === 'round') {
      p.push(box(0.1, 0.1, 0, 1.8, 1.8, 0.35, frame), box(0.15, 0.15, 0.35, 1.7, 1.7, 0.12, sheet, { top: (ctx, w, h) => { rect(ctx, 0, 0, w, h, sheet); ctx.fillStyle = shade(sheet, -0.15); ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.3, h * 0.3, 0, 0, 7); ctx.fill(); } }), pillow(0.25, 0.3, 0.47, 0.35, 0.5), pillow(0.25, 1.1, 0.47, 0.35, 0.5));
      return p;
    }
    p.push(box(0.04, 0.05, 0, W - 0.08, D - 0.1, H, frame, { py: kind === 'gamer' ? (ctx, w, h, t) => { rect(ctx, 0, 0, w, h, frame); rect(ctx, 0, h - 2, w, 2, hsl(t * 60, 100, 60)); } : undefined }));
    p.push(box(0.04, 0.05, 0, 0.12, D - 0.1, H + 0.55, frame));
    p.push(box(0.12, 0.08, H, W - 0.2, D - 0.16, 0.14, '#f4f1ea'));
    p.push(box(0.75, 0.06, H + 0.1, W - 0.82, D - 0.12, 0.06, sheet));
    for (let i = 0; i < D; i++) p.push(pillow(0.2, 0.18 + i * 0.95, H + 0.14, 0.38, 0.65));
    if (kind === 'bunk') {
      const z = 1.15;
      p.push(box(0.04, 0.05, z, W - 0.08, D - 0.1, 0.18, frame), box(0.12, 0.08, z + 0.18, W - 0.2, D - 0.16, 0.12, '#f4f1ea'), box(0.75, 0.06, z + 0.28, W - 0.82, D - 0.12, 0.05, shade(sheet, 0.2)), pillow(0.2, 0.18, z + 0.3, 0.38, 0.65));
      p.push(box(W - 0.12, 0.05, 0, 0.08, 0.08, z + 0.6, frame), box(W - 0.12, D - 0.13, 0, 0.08, 0.08, z + 0.6, frame), box(1.4, D - 0.1, 0.1, 0.06, 0.06, z + 0.4, frame));
    }
    return p;
  };
}
add({ id: 'colchao-chao', name: 'Colchão no chão', cat: 'camas', price: 0, rarity: 'sucata', w: 2, d: 1, place: 'floor', sleep: 0.2, sad: true, model: bedModel('floor', '#7a8fb0', '#000'), desc: 'Tem formato do seu corpo. E de outras coisas.' });
add({ id: 'colchao-novo', name: 'Colchão novo de solteiro', cat: 'camas', price: 40, rarity: 'comum', w: 2, d: 1, place: 'floor', sleep: 0.22, model: () => [box(0.05, 0.1, 0, 1.9, 0.8, 0.18, '#eef0f4', { py: stripesPaint('#eef0f4', '#d8dce6', 4) }), pillow(0.12, 0.2, 0.18, 0.32, 0.55), box(0.8, 0.12, 0.18, 1.1, 0.76, 0.04, '#5b8cc9')] });
([['blue', '#4a74b5'], ['green', '#4f8f5a'], ['pink', '#e59bbd'], ['gray', '#7b808c']] as const).forEach(([n, s]) => add({ id: `cama-solteiro-${n}`, name: `Cama de solteiro (lençol ${COLOR_LABEL[n]})`, cat: 'camas', price: 90, rarity: 'comum', w: 2, d: 1, place: 'floor', sleep: 0.45, model: bedModel('single', s, PALETTE.wood) }));
add({ id: 'cama-box', name: 'Cama box solteiro', cat: 'camas', price: 160, rarity: 'incomum', w: 2, d: 1, place: 'floor', sleep: 0.6, model: bedModel('box', '#8a6fb5', '#e9e6df') });
add({ id: 'beliche', name: 'Beliche', cat: 'camas', price: 210, rarity: 'incomum', w: 2, d: 1, place: 'floor', sleep: 0.4, model: bedModel('bunk', '#c0392b', PALETTE.lightwood) });
([['navy', '#2b3a67'], ['beige', '#d8c7a1'], ['red', '#a83232']] as const).forEach(([n, s]) => add({ id: `cama-casal-${n}`, name: `Cama de casal (${COLOR_LABEL[n]})`, cat: 'camas', price: 380, rarity: 'raro', w: 2, d: 2, place: 'floor', sleep: 0.45, model: bedModel('double', s, PALETTE.darkwood) }));
add({ id: 'cama-gamer', name: 'Cama gamer com LED', cat: 'camas', price: 520, rarity: 'raro', w: 2, d: 2, place: 'floor', sleep: 0.45, model: bedModel('gamer', '#1f1f2b', '#111'), collection: 'gamer' });
add({ id: 'cama-king', name: 'Cama king size', cat: 'camas', price: 1300, rarity: 'epico', w: 3, d: 2, place: 'floor', sleep: 0.45, model: bedModel('king', '#e8e2d4', PALETTE.mahogany), minLevel: 10 });
add({ id: 'cama-redonda', name: 'Cama redonda de luxo', cat: 'camas', price: 3500, rarity: 'lendario', w: 2, d: 2, place: 'floor', sleep: 0.5, model: bedModel('round', '#7a1f2b', PALETTE.gold), minLevel: 15, collection: 'imperio' });
add({ id: 'rede', name: 'Rede de descanso', cat: 'camas', price: 120, rarity: 'incomum', w: 3, d: 1, place: 'floor', sleep: 0.5, model: () => [box(0.05, 0.4, 0, 0.12, 0.12, 1.4, PALETTE.darkwood), box(2.83, 0.4, 0, 0.12, 0.12, 1.4, PALETTE.darkwood), box(0.4, 0.25, 0.45, 2.2, 0.5, 0.1, '#e07b39', { top: stripesPaint('#e07b39', '#f3c25b', 3) })] });

/* ===================== SOFÁS ===================== */

function sofaModel(w: number, c: string, kind: 'basic' | 'chester' | 'modern' | 'armchair' | 'old' | 'bench' = 'basic'): () => Prim[] {
  return () => {
    const seat = 0.42;
    if (kind === 'bench') return [...legs4(0.1, 0.25, w - 0.2, 0.5, 0.4, '#555'), box(0.05, 0.2, 0.4, w - 0.1, 0.6, 0.06, c, { top: plankPaint(c, true) })];
    const back = kind === 'modern' ? 0.35 : 0.55;
    const arm = kind === 'chester' ? 0.3 : 0.22;
    const p: Prim[] = [
      box(0.05, 0.1, 0, w - 0.1, 0.85, 0.3, shade(c, -0.08)),
      box(0.05, 0.08, 0.3, w - 0.1, 0.25, back, c, { my: kind === 'chester' ? (ctx, ww, hh) => { rect(ctx, 0, 0, ww, hh, c); ctx.fillStyle = shade(c, -0.25); for (let x = 3; x < ww; x += 6) for (let y = 3; y < hh; y += 6) ctx.fillRect(x, y, 1, 1); } : undefined }),
      box(0.05 + arm, 0.3, 0.3, w - 0.1 - arm * 2, 0.62, 0.12, c, { top: cushionPaint(c, Math.max(1, Math.round(w))) }),
      box(0.05, 0.3, 0.3, arm, 0.65, kind === 'modern' ? 0.15 : 0.25, shade(c, -0.03)),
      box(w - 0.05 - arm, 0.3, 0.3, arm, 0.65, kind === 'modern' ? 0.15 : 0.25, shade(c, -0.03)),
    ];
    if (kind === 'old') p.push(spr(w * 0.6, 0.6, seat + 0.02, (ctx) => { ctx.fillStyle = '#e8d9a8'; ctx.fillRect(-3, -2, 6, 3); ctx.fillStyle = '#8a7a50'; ctx.fillRect(-1, -1, 2, 1); }, 0.1, 0.05));
    return p;
  };
}
add({ id: 'sofa-velho', name: 'Sofá velho rasgado', cat: 'sofas', price: 25, rarity: 'sucata', w: 2, d: 1, place: 'floor', sit: 0.42, model: sofaModel(2, '#7b6a52', 'old') });
add({ id: 'banco-madeira', name: 'Banco de madeira', cat: 'sofas', price: 30, rarity: 'comum', w: 2, d: 1, place: 'floor', sit: 0.46, model: sofaModel(2, PALETTE.wood, 'bench') });
variants(['gray', 'blue', 'green', 'beige', 'red'], (c, n) => add({ id: `sofa-2-${n}`, name: `Sofá de 2 lugares (${COLOR_LABEL[n]})`, cat: 'sofas', price: 140, rarity: 'incomum', w: 2, d: 1, place: 'floor', sit: 0.46, model: sofaModel(2, c) }));
variants(['gray', 'navy', 'beige'], (c, n) => add({ id: `sofa-3-${n}`, name: `Sofá de 3 lugares (${COLOR_LABEL[n]})`, cat: 'sofas', price: 260, rarity: 'raro', w: 3, d: 1, place: 'floor', sit: 0.46, model: sofaModel(3, c) }));
variants(['black', 'darkwood'], (c, n) => add({ id: `sofa-chester-${n}`, name: `Sofá Chesterfield (${COLOR_LABEL[n]})`, cat: 'sofas', price: 950, rarity: 'epico', w: 3, d: 1, place: 'floor', sit: 0.46, model: sofaModel(3, n === 'black' ? '#262221' : '#6b3a22', 'chester'), minLevel: 9, collection: 'ceo' }));
add({ id: 'sofa-moderno', name: 'Sofá moderno baixo', cat: 'sofas', price: 520, rarity: 'raro', w: 3, d: 1, place: 'floor', sit: 0.44, model: sofaModel(3, '#d9d4c8', 'modern') });
variants(['orange', 'teal', 'mahogany', 'pink'], (c, n) => add({ id: `poltrona-${n}`, name: `Poltrona (${COLOR_LABEL[n]})`, cat: 'sofas', price: 110, rarity: 'incomum', w: 1, d: 1, place: 'floor', sit: 0.46, model: sofaModel(1, c), collection: n === 'pink' ? 'kawaii' : undefined }));
add({ id: 'poltrona-ouro', name: 'Poltrona do Magnata', cat: 'sofas', price: 2600, rarity: 'lendario', w: 1, d: 1, place: 'floor', sit: 0.46, model: sofaModel(1, PALETTE.gold, 'chester'), minLevel: 16, collection: 'imperio' });

/* ===================== ARMÁRIOS ===================== */

add({ id: 'caixa-papelao', name: 'Pilha de caixas de papelão', cat: 'armarios', price: 0, rarity: 'sucata', w: 1, d: 1, place: 'floor', surface: 0.7, sad: true, model: () => [box(0.1, 0.15, 0, 0.75, 0.7, 0.4, '#b48a56', { top: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#c49a66'); rect(ctx, 0, h / 2 - 1, w, 2, '#d8c49a'); } }), box(0.2, 0.2, 0.4, 0.55, 0.55, 0.3, '#a37a48', { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#a37a48'); ctx.fillStyle = '#5a3d20'; ctx.font = '6px monospace'; ctx.fillText('FRÁGIL', 2, h / 2 + 2); } })] });
const wardrobe = (c: string, w: number, doors: number, tall = 1.9, handle = '#c9c9c9'): () => Prim[] => () => [box(0.05, 0.15, 0, w - 0.1, 0.75, tall, c, { py: doorsPaint(c, doors, handle) }), box(0.03, 0.13, tall, w - 0.06, 0.79, 0.05, shade(c, -0.1))];
add({ id: 'arara-roupas', name: 'Arara de roupas', cat: 'armarios', price: 30, rarity: 'comum', w: 2, d: 1, place: 'floor', model: () => [box(0.1, 0.45, 0, 0.06, 0.06, 1.5, '#888'), box(1.84, 0.45, 0, 0.06, 0.06, 1.5, '#888'), box(0.1, 0.46, 1.45, 1.8, 0.04, 0.04, '#888'), ...[0, 1, 2, 3, 4].map((i) => box(0.3 + i * 0.3, 0.35, 0.75, 0.22, 0.25, 0.65, ['#c0392b', '#2980b9', '#f1c40f', '#27ae60', '#ecf0f1'][i], { outline: true }))] });
variants(['white', 'wood', 'darkwood'], (c, n) => add({ id: `guarda-roupa-2-${n}`, name: `Guarda-roupa 2 portas (${COLOR_LABEL[n]})`, cat: 'armarios', price: 120, rarity: 'comum', w: 2, d: 1, place: 'floor', model: wardrobe(c, 2, 2) }));
variants(['white', 'wood'], (c, n) => add({ id: `guarda-roupa-3-${n}`, name: `Guarda-roupa 3 portas (${COLOR_LABEL[n]})`, cat: 'armarios', price: 230, rarity: 'incomum', w: 3, d: 1, place: 'floor', model: wardrobe(c, 3, 3) }));
add({ id: 'armario-aco', name: 'Armário de aço', cat: 'armarios', price: 90, rarity: 'comum', w: 1, d: 1, place: 'floor', model: wardrobe('#8b929e', 1, 2, 1.8, '#333') });
add({ id: 'arquivo-gavetas', name: 'Arquivo de 4 gavetas', cat: 'armarios', price: 75, rarity: 'comum', w: 1, d: 1, place: 'floor', surface: 1.3, model: () => [box(0.15, 0.15, 0, 0.7, 0.7, 1.3, '#9aa0aa', { py: drawersPaint(4, '#9aa0aa', '#333') })] });
add({ id: 'comoda', name: 'Cômoda', cat: 'armarios', price: 110, rarity: 'incomum', w: 2, d: 1, place: 'floor', surface: 0.85, model: () => [box(0.05, 0.15, 0, 1.9, 0.75, 0.85, PALETTE.lightwood, { py: drawersPaint(3, PALETTE.lightwood, '#6b4a2b', 2) })] });
add({ id: 'aparador', name: 'Aparador de sala', cat: 'armarios', price: 170, rarity: 'incomum', w: 2, d: 1, place: 'floor', surface: 0.75, model: () => [...legs4(0.1, 0.3, 1.8, 0.5, 0.25, '#222'), box(0.05, 0.25, 0.25, 1.9, 0.6, 0.5, PALETTE.darkwood, { py: doorsPaint(PALETTE.darkwood, 3, PALETTE.gold) })] });
add({ id: 'rack-tv', name: 'Rack para TV', cat: 'armarios', price: 95, rarity: 'comum', w: 2, d: 1, place: 'floor', surface: 0.5, model: () => [box(0.05, 0.2, 0, 1.9, 0.65, 0.5, '#3c3c44', { py: drawersPaint(1, '#3c3c44', '#aaa', 3) })] });
add({ id: 'cofre-pequeno', name: 'Cofre pequeno', cat: 'armarios', price: 200, rarity: 'raro', w: 1, d: 1, place: 'floor', surface: 0.6, use: 'money', model: () => [box(0.2, 0.2, 0, 0.6, 0.6, 0.6, '#3d434d', { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#3d434d'); rect(ctx, 3, 3, w - 6, h - 6, '#4a515c'); ctx.fillStyle = '#c9c9c9'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 4, 0, 7); ctx.fill(); } })] });
add({ id: 'cofre-forte', name: 'Cofre-forte de banco', cat: 'armarios', price: 2200, rarity: 'lendario', w: 2, d: 1, place: 'floor', use: 'money', minLevel: 13, collection: 'imperio', model: () => [box(0.05, 0.1, 0, 1.9, 0.85, 1.7, '#5b6170', { py: (ctx, w, h, t) => { rect(ctx, 0, 0, w, h, '#5b6170'); ctx.strokeStyle = '#2d3038'; ctx.strokeRect(3, 3, w - 6, h - 6); ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(t * 0.3); ctx.fillStyle = PALETTE.gold; for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.fillRect(0, -1, 10, 2); } ctx.restore(); ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(w / 2, h / 2, 4, 0, 7); ctx.fill(); } })] });

/* ===================== ESTANTES ===================== */

const shelf = (c: string, w: number, h: number, shelves: number, seed: number): () => Prim[] => () => [box(0.05, 0.2, 0, w - 0.1, 0.6, h, c, { py: booksPaint(shelves, c, seed) })];
add({ id: 'estante-tijolos', name: 'Estante de tijolo e tábua', cat: 'estantes', price: 15, rarity: 'sucata', w: 2, d: 1, place: 'floor', model: () => [box(0.1, 0.3, 0, 0.25, 0.4, 0.25, '#a2513a'), box(1.65, 0.3, 0, 0.25, 0.4, 0.25, '#a2513a'), box(0.05, 0.25, 0.25, 1.9, 0.5, 0.05, '#b08a5a'), box(0.1, 0.3, 0.3, 0.25, 0.4, 0.25, '#a2513a'), box(1.65, 0.3, 0.3, 0.25, 0.4, 0.25, '#a2513a'), box(0.05, 0.25, 0.55, 1.9, 0.5, 0.05, '#b08a5a'), box(0.5, 0.35, 0.3, 0.9, 0.3, 0.2, '#c0392b', { py: booksPaint(1, '#b08a5a', 3) })] });
add({ id: 'prateleira-simples', name: 'Estante simples', cat: 'estantes', price: 45, rarity: 'comum', w: 1, d: 1, place: 'floor', model: shelf('#c9a46a', 1, 1.3, 3, 1) });
variants(['wood', 'white', 'black', 'darkwood'], (c, n, i) => add({ id: `estante-livros-${n}`, name: `Estante de livros (${COLOR_LABEL[n]})`, cat: 'estantes', price: 110, rarity: 'incomum', w: 2, d: 1, place: 'floor', model: shelf(c, 2, 1.8, 4, i + 2) }));
add({ id: 'estante-alta', name: 'Estante alta de biblioteca', cat: 'estantes', price: 380, rarity: 'raro', w: 2, d: 1, place: 'floor', model: shelf(PALETTE.mahogany, 2, 2.4, 6, 9), collection: 'ceo' });
add({ id: 'estante-nicho', name: 'Estante de nichos', cat: 'estantes', price: 160, rarity: 'incomum', w: 2, d: 1, place: 'floor', model: () => [box(0.05, 0.2, 0, 1.9, 0.6, 1.6, '#f0ece4', { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#f0ece4'); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { rect(ctx, 3 + c * (w - 6) / 3, 3 + r * (h - 6) / 3, (w - 6) / 3 - 3, (h - 6) / 3 - 3, '#d9d3c7'); if ((r + c) % 2) rect(ctx, 6 + c * (w - 6) / 3, 3 + r * (h - 6) / 3 + 6, 8, (h - 6) / 3 - 9, ['#5aa', '#d75', '#b6d', '#7c5'][(r + c) % 4]); } } })] });
add({ id: 'estante-gamer', name: 'Estante de colecionáveis com LED', cat: 'estantes', price: 420, rarity: 'raro', w: 2, d: 1, place: 'floor', model: () => [box(0.05, 0.2, 0, 1.9, 0.6, 1.9, '#141418', { py: (ctx, w, h, t) => { rect(ctx, 0, 0, w, h, '#141418'); for (let r = 0; r < 4; r++) { rect(ctx, 2, 2 + r * (h / 4), w - 4, h / 4 - 3, 'rgba(120,140,255,0.12)'); rect(ctx, 2, r * (h / 4) + h / 4 - 3, w - 4, 1, hsl(t * 60 + r * 50, 100, 60)); for (let k = 0; k < 4; k++) rect(ctx, 6 + k * (w - 12) / 4, r * (h / 4) + 6, 5, h / 4 - 10, ['#e44', '#4e4', '#44e', '#ee4'][(k + r) % 4]); } } })], collection: 'gamer' });
add({ id: 'prateleira-vinil', name: 'Prateleira de discos de vinil', cat: 'estantes', price: 260, rarity: 'raro', w: 2, d: 1, place: 'floor', model: shelf('#3c2a1f', 2, 1.0, 2, 13) });

/* ===================== PLANTAS ===================== */

type PlantKind = 'dead' | 'cactus' | 'succulent' | 'fern' | 'monstera' | 'palm' | 'bonsai' | 'orchid' | 'money' | 'tree' | 'flower' | 'bamboo';
function plantModel(kind: PlantKind, pot: string, big = false): () => Prim[] {
  return () => {
    const ps = big ? 0.5 : 0.3;
    const ph = big ? 0.45 : 0.22;
    const x0 = 0.5 - ps / 2;
    const p: Prim[] = [box(x0, x0, 0, ps, ps, ph, pot, { top: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#4a2f1d'); } })];
    const z = ph;
    const g = ['#2f8f46', '#3fae57', '#257a3a', '#58c46c'];
    const draw = {
      dead: (ctx: CanvasRenderingContext2D) => { ctx.strokeStyle = '#7a5a2f'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-2, -12); ctx.lineTo(-6, -16); ctx.moveTo(-2, -12); ctx.lineTo(3, -18); ctx.stroke(); ctx.fillStyle = '#9b7b3f'; ctx.fillRect(3, -18, 3, 2); },
      cactus: (ctx: CanvasRenderingContext2D) => { ctx.fillStyle = '#3e9b4f'; ctx.fillRect(-3, -16, 6, 16); ctx.fillRect(-8, -11, 3, 6); ctx.fillRect(-8, -8, 5, 3); ctx.fillRect(5, -13, 3, 6); ctx.fillStyle = '#f7e36b'; ctx.fillRect(-1, -18, 2, 2); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-2, -15, 1, 13); },
      succulent: (ctx: CanvasRenderingContext2D) => { ctx.fillStyle = '#7fbf8f'; for (let i = 0; i < 6; i++) { const a = i * 1.05; ctx.fillRect(Math.cos(a) * 4 - 2, -4 + Math.sin(a) * 2 - 2, 4, 3); } ctx.fillStyle = '#a7d8b2'; ctx.fillRect(-1, -5, 3, 3); },
      fern: leafBlob(g, 14, 18, 2), monstera: leafBlob(['#1f7a3a', '#2b9447', '#176a31'], 20, 16, 5),
      palm: (ctx: CanvasRenderingContext2D, t: number) => { ctx.fillStyle = '#8b6a3e'; ctx.fillRect(-2, -34, 4, 34); leafBlob(g, 16, 12, 3)(ctx, t); ctx.save(); ctx.translate(0, -28); leafBlob(['#2f8f46', '#3fae57'], 14, 12, 7)(ctx, t); ctx.restore(); },
      bonsai: (ctx: CanvasRenderingContext2D, t: number) => { ctx.fillStyle = '#6b4a2b'; ctx.fillRect(-1, -10, 3, 10); ctx.fillRect(-6, -10, 6, 2); ctx.save(); ctx.translate(-4, -6); leafBlob(['#3b7d3a', '#4f9a45'], 7, 9, 4)(ctx, t); ctx.restore(); },
      orchid: (ctx: CanvasRenderingContext2D) => { ctx.strokeStyle = '#4a7a3a'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1, -20); ctx.stroke(); ctx.fillStyle = '#f2a6d7'; [[-3, -20], [3, -17], [-2, -14], [4, -22]].forEach(([x, y]) => ctx.fillRect(x - 2, y - 2, 4, 4)); ctx.fillStyle = '#2f8f46'; ctx.fillRect(-6, -3, 12, 3); },
      money: (ctx: CanvasRenderingContext2D, t: number) => { ctx.fillStyle = '#6b4a2b'; ctx.fillRect(-1, -18, 3, 18); leafBlob(['#2f8f46', '#3fae57'], 12, 14, 8)(ctx, t); for (let i = 0; i < 5; i++) { ctx.fillStyle = Math.sin(t * 3 + i) > 0.3 ? '#ffe680' : '#e2b53f'; ctx.fillRect(-9 + i * 4, -20 + (i % 2) * 6, 3, 3); } },
      tree: (ctx: CanvasRenderingContext2D, t: number) => { ctx.fillStyle = '#7a5530'; ctx.fillRect(-2, -26, 4, 26); ctx.save(); ctx.translate(0, -30); leafBlob(['#2f7d3f', '#3a9a4c', '#277035'], 18, 22, 11)(ctx, t); ctx.restore(); },
      flower: (ctx: CanvasRenderingContext2D) => { ctx.fillStyle = '#2f8f46'; ctx.fillRect(-1, -12, 2, 12); ctx.fillRect(-5, -5, 4, 2); [['#e74c3c', -4, -14], ['#f1c40f', 3, -16], ['#9b59b6', 0, -19]].forEach(([c, x, y]) => { ctx.fillStyle = c as string; ctx.fillRect((x as number) - 2, (y as number) - 2, 4, 4); }); },
      bamboo: (ctx: CanvasRenderingContext2D) => { ctx.fillStyle = '#7fb342'; [-4, 0, 4].forEach((x, i) => { ctx.fillRect(x - 1, -26 + i * 4, 2, 26 - i * 4); ctx.fillStyle = '#5d8a2f'; ctx.fillRect(x - 1, -14, 2, 1); ctx.fillStyle = '#7fb342'; }); ctx.fillStyle = '#4caf50'; ctx.fillRect(-8, -24, 5, 2); ctx.fillRect(4, -20, 5, 2); },
    }[kind];
    const scale = big ? 1.7 : 1;
    p.push(spr(0.5, 0.5, z, (ctx, t) => { ctx.save(); ctx.scale(scale, scale); draw(ctx, t); ctx.restore(); }, ps / 2, big ? 1.4 : 0.6));
    return p;
  };
}
add({ id: 'planta-morta', name: 'Planta morta (era um manjericão)', cat: 'plantas', price: 0, rarity: 'sucata', w: 1, d: 1, place: 'top', use: 'plant', model: plantModel('dead', '#b0623d'), sad: true });
const plants: [PlantKind, string, number, Rarity, boolean][] = [
  ['cactus', 'Cacto', 6, 'comum', false], ['succulent', 'Suculenta', 5, 'comum', false], ['flower', 'Vasinho de flores', 10, 'comum', false],
  ['fern', 'Samambaia', 18, 'comum', false], ['bonsai', 'Bonsai', 90, 'raro', false], ['orchid', 'Orquídea', 60, 'incomum', false],
  ['bamboo', 'Bambu da sorte', 25, 'incomum', false], ['monstera', 'Costela-de-adão', 70, 'incomum', true], ['palm', 'Palmeira de vaso', 120, 'raro', true],
  ['tree', 'Ficus grande', 150, 'raro', true], ['fern', 'Samambaia gigante', 85, 'incomum', true],
];
const pots: [string, string][] = [['terracota', '#b0623d'], ['branco', '#ece8e0'], ['preto', '#2a2a2e']];
plants.forEach(([k, n, price, r, big]) => pots.forEach(([pn, pc], j) => {
  if (j > 0 && price < 10) return;
  add({ id: `planta-${k}-${big ? 'g' : 'p'}-${j}`, name: `${n} (vaso ${pn})`, cat: 'plantas', price: price + j * 3, rarity: r, w: 1, d: 1, place: big ? 'floor' : 'top', use: 'plant', model: plantModel(k, pc, big) });
}));
add({ id: 'arvore-dinheiro', name: 'Árvore do dinheiro dourada', cat: 'plantas', price: 1800, rarity: 'lendario', w: 1, d: 1, place: 'floor', use: 'plant', model: plantModel('money', PALETTE.gold, true), minLevel: 12, collection: 'imperio' });
add({ id: 'jardim-vertical', name: 'Jardim vertical', cat: 'plantas', price: 480, rarity: 'epico', w: 2, d: 1, place: 'floor', use: 'plant', model: () => [box(0.05, 0.1, 0, 1.9, 0.2, 2.2, '#5a4a3a', { py: (ctx, w, h, t) => { rect(ctx, 0, 0, w, h, '#3d5a32'); for (let i = 0; i < 90; i++) { const x = (i * 37) % w, y = (i * 61) % h; rect(ctx, x, y + Math.sin(t + i) * 0.5, 5, 3, ['#2f8f46', '#3fae57', '#58c46c', '#257a3a'][i % 4]); } } })] });

/* ===================== CLIMATIZAÇÃO ===================== */

const fan = (c: string, kind: 'table' | 'floor' | 'tower' | 'old'): () => Prim[] => () => {
  if (kind === 'tower') return [box(0.35, 0.35, 0, 0.3, 0.3, 1.0, c, { py: (ctx, w, h, t) => { rect(ctx, 0, 0, w, h, c); for (let y = 6; y < h - 4; y += 3) rect(ctx, 2, y + ((t * 20) % 3), w - 4, 1, shade(c, -0.3)); } })];
  const h = kind === 'table' ? 0.25 : 1.0;
  return [
    box(0.3, 0.3, 0, 0.4, 0.4, 0.05, c), box(0.47, 0.47, 0.05, 0.06, 0.06, h, c),
    spr(0.5, 0.5, h + 0.2, (ctx, t) => { const r = kind === 'table' ? 7 : 10; ctx.strokeStyle = kind === 'old' ? '#8a8a7a' : '#ccc'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, r * 0.8, r, 0, 0, 7); ctx.stroke(); ctx.save(); ctx.scale(0.8, 1); ctx.rotate(t * (kind === 'old' ? 8 : 18)); ctx.fillStyle = kind === 'old' ? 'rgba(150,140,110,0.8)' : 'rgba(200,220,255,0.7)'; for (let i = 0; i < 3; i++) { ctx.rotate((Math.PI * 2) / 3); ctx.fillRect(0, -2, r - 1, 4); } ctx.restore(); ctx.fillStyle = c; ctx.fillRect(-1, -1, 3, 3); }, 0.25, 0.4),
  ];
};
add({ id: 'ventilador-velho', name: 'Ventilador velho barulhento', cat: 'climatizacao', price: 10, rarity: 'sucata', w: 1, d: 1, place: 'top', use: 'fan', model: fan('#9c9784', 'old') });
add({ id: 'ventilador-mesa', name: 'Ventilador de mesa', cat: 'climatizacao', price: 25, rarity: 'comum', w: 1, d: 1, place: 'top', use: 'fan', model: fan('#e6e6e6', 'table') });
add({ id: 'ventilador-coluna', name: 'Ventilador de coluna', cat: 'climatizacao', price: 55, rarity: 'comum', w: 1, d: 1, place: 'floor', use: 'fan', model: fan('#2b2b2b', 'floor') });
add({ id: 'ventilador-torre', name: 'Ventilador torre', cat: 'climatizacao', price: 130, rarity: 'incomum', w: 1, d: 1, place: 'floor', use: 'fan', model: fan('#d9d9de', 'tower') });
add({ id: 'umidificador', name: 'Umidificador de ar', cat: 'climatizacao', price: 70, rarity: 'incomum', w: 1, d: 1, place: 'top', model: () => [box(0.38, 0.38, 0, 0.24, 0.24, 0.25, '#e8f4ff'), spr(0.5, 0.5, 0.3, (ctx, t) => { ctx.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 4; i++) { const y = -((t * 10 + i * 5) % 18); ctx.fillRect(-2 + Math.sin(t + i) * 2, y, 4, 3); } }, 0.1, 0.4)] });
const acPaint = (c: string, big: boolean): Paint => (ctx, w, h, t) => { rect(ctx, 0, 0, w, h, c); rect(ctx, 0, 0, w, 2, shade(c, 0.2)); rect(ctx, 3, h - 6, w - 6, 3, shade(c, -0.25)); for (let x = 4; x < w - 4; x += 3) rect(ctx, x, h - 6 + ((t * 4) % 2), 1, 3, shade(c, -0.4)); rect(ctx, w - 8, 4, 4, 2, big ? '#4ade80' : '#60a5fa'); };
add({ id: 'ar-janela', name: 'Ar-condicionado de janela (pingando)', cat: 'climatizacao', price: 180, rarity: 'incomum', w: 1, d: 1, place: 'wall', wallH: 0.55, wallZ: 1.4, wallPaint: (ctx, w, h, t) => { rect(ctx, 0, 0, w, h, '#d6d2c4'); for (let y = 4; y < h - 3; y += 3) rect(ctx, 3, y, w * 0.55, 1, '#9b978a'); rect(ctx, w * 0.7, 5, 6, 4, '#555'); if (Math.floor(t * 2) % 3 === 0) rect(ctx, w / 2, h - 2, 1, 2, '#7ab8ff'); } });
add({ id: 'ar-split', name: 'Ar-condicionado split', cat: 'climatizacao', price: 420, rarity: 'raro', w: 2, d: 1, place: 'wall', wallH: 0.45, wallZ: 2.0, wallPaint: acPaint('#f2f3f5', false) });
add({ id: 'ar-split-inverter', name: 'Split inverter silencioso', cat: 'climatizacao', price: 750, rarity: 'epico', w: 2, d: 1, place: 'wall', wallH: 0.45, wallZ: 2.0, wallPaint: acPaint('#2b2d33', true), minLevel: 8 });
add({ id: 'aquecedor', name: 'Aquecedor a óleo', cat: 'climatizacao', price: 90, rarity: 'incomum', w: 1, d: 1, place: 'floor', model: () => [box(0.25, 0.35, 0, 0.5, 0.3, 0.65, '#e9e6df', { py: stripesPaint('#e9e6df', '#c9c5bc', 3) })] });

/* ===================== TV ===================== */

const tv = (wd: number, ht: number, frame: string, kind: 'crt' | 'flat' | 'oled', stand = true): () => Prim[] => () => {
  if (kind === 'crt') return [box(0.2, 0.15, 0, 0.6, 0.6, 0.5, frame, { py: (ctx, w, h, t) => { rect(ctx, 0, 0, w, h, frame); screenPaint('tv', 0)(ctx, w * 0.75, h - 6, t); ctx.fillStyle = '#333'; ctx.fillRect(w * 0.8, 6, 4, 4); ctx.fillRect(w * 0.8, 14, 4, 4); } }), spr(0.5, 0.4, 0.5, (ctx) => { ctx.strokeStyle = '#666'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-8, -14); ctx.moveTo(0, 0); ctx.lineTo(7, -15); ctx.stroke(); }, 0.1, 0.4)];
  const x0 = (Math.ceil(wd) - wd) / 2;
  return [
    ...(stand ? [box(x0 + wd / 2 - 0.2, 0.3, 0, 0.4, 0.2, 0.03, frame), box(x0 + wd / 2 - 0.04, 0.35, 0.03, 0.08, 0.06, 0.12, frame)] : []),
    box(x0, 0.38, 0.12, wd, kind === 'oled' ? 0.03 : 0.06, ht, frame, { py: screenPaint('tv', kind === 'oled' ? 0.8 : 2, frame) }),
  ];
};
add({ id: 'tv-tubo', name: 'TV de tubo com antena', cat: 'tv', price: 30, rarity: 'sucata', w: 1, d: 1, place: 'top', use: 'tv', model: tv(1, 1, '#4a4a4a', 'crt') });
add({ id: 'tv-tubo-29', name: 'TV de tubo 29" de tela plana', cat: 'tv', price: 60, rarity: 'comum', w: 1, d: 1, place: 'top', use: 'tv', model: tv(1, 1, '#2b2b2b', 'crt') });
add({ id: 'tv-32', name: 'TV LED 32"', cat: 'tv', price: 150, rarity: 'incomum', w: 1, d: 1, place: 'top', use: 'tv', model: tv(0.95, 0.55, '#151515', 'flat') });
add({ id: 'tv-43', name: 'Smart TV 43"', cat: 'tv', price: 280, rarity: 'incomum', w: 2, d: 1, place: 'top', use: 'tv', model: tv(1.3, 0.75, '#151515', 'flat') });
add({ id: 'tv-55', name: 'Smart TV 55"', cat: 'tv', price: 520, rarity: 'raro', w: 2, d: 1, place: 'top', use: 'tv', model: tv(1.7, 0.95, '#111', 'flat') });
add({ id: 'tv-65-oled', name: 'TV OLED 65"', cat: 'tv', price: 1200, rarity: 'epico', w: 2, d: 1, place: 'top', use: 'tv', model: tv(1.95, 1.1, '#0a0a0a', 'oled'), minLevel: 9 });
add({ id: 'tv-85', name: 'TV 85" de cinema', cat: 'tv', price: 2600, rarity: 'lendario', w: 3, d: 1, place: 'floor', use: 'tv', model: () => [box(0.2, 0.3, 0, 2.6, 0.4, 0.4, '#222'), ...tv(2.8, 1.5, '#0a0a0a', 'oled', false)().map((b) => (b.t === 'box' ? { ...b, z: b.z + 0.3 } : b))], minLevel: 13 });
add({ id: 'projetor-tela', name: 'Projetor + telão', cat: 'tv', price: 900, rarity: 'epico', w: 3, d: 1, place: 'wall', use: 'tv', wallH: 1.4, wallZ: 0.8, wallPaint: (ctx, w, h, t) => { rect(ctx, 0, 0, w, 3, '#222'); rect(ctx, 2, 3, w - 4, h - 4, '#f4f4f4'); screenPaint('game', 0)(ctx, w - 4, h - 6, t); } });

/* ===================== CONSOLES ===================== */

const consoleM = (c: string, kind: 'retro' | 'box' | 'tall' | 'handheld' | 'arcade' | 'pinball' | 'vr'): () => Prim[] => () => {
  switch (kind) {
    case 'retro': return [box(0.25, 0.4, 0, 0.5, 0.35, 0.08, c, { top: (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); rect(ctx, w * 0.3, 2, w * 0.4, h * 0.5, '#555'); } }), box(0.3, 0.8, 0, 0.14, 0.08, 0.03, '#444'), box(0.55, 0.8, 0, 0.14, 0.08, 0.03, '#444')];
    case 'box': return [box(0.2, 0.35, 0, 0.6, 0.4, 0.12, c, { py: (ctx, w, h, t) => { rect(ctx, 0, 0, w, h, c); rect(ctx, 3, h / 2, 3, 2, Math.sin(t * 2) > 0 ? '#4ade80' : '#14532d'); } }), box(0.3, 0.8, 0, 0.18, 0.1, 0.04, '#222')];
    case 'tall': return [box(0.38, 0.3, 0, 0.24, 0.45, 0.6, c, { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); rect(ctx, w / 2 - 1, 0, 2, h, '#3b82f6'); } }), box(0.6, 0.8, 0, 0.18, 0.1, 0.04, c)];
    case 'handheld': return [box(0.3, 0.55, 0, 0.4, 0.2, 0.04, c, { top: (ctx, w, h, t) => { rect(ctx, 0, 0, w, h, c); screenPaint('game', 0)(ctx, w * 0.5, h, t); } })];
    case 'vr': return [box(0.3, 0.45, 0, 0.4, 0.25, 0.15, c, { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); rect(ctx, 2, 2, w - 4, h - 4, '#111'); } })];
    case 'arcade': return [box(0.1, 0.15, 0, 0.8, 0.7, 1.0, c, { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); rect(ctx, 4, h * 0.5, w - 8, 4, '#222'); rect(ctx, w * 0.3, h * 0.45, 3, 3, '#e33'); rect(ctx, w * 0.6, h * 0.45, 3, 3, '#3e3'); } }), box(0.1, 0.25, 1.0, 0.8, 0.5, 0.75, c, { py: (ctx, w, h, t) => { rect(ctx, 0, 0, w, h, c); screenPaint('retro', 3, '#000')(ctx, w, h * 0.8, t); rect(ctx, 0, h * 0.82, w, h * 0.18, hsl(t * 50, 90, 55)); } })];
    case 'pinball': return [...legs4(0.1, 0.1, 0.8, 1.8, 0.75, '#333'), box(0.08, 0.08, 0.75, 0.84, 1.84, 0.15, c, { top: (ctx, w, h, t) => { rect(ctx, 0, 0, w, h, '#1a1440'); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(w / 2 + Math.sin(t * 3) * 8, h / 2 + Math.cos(t * 2) * 20, 2, 0, 7); ctx.fill(); rect(ctx, 4, h - 8, 8, 2, '#e33'); rect(ctx, w - 12, h - 8, 8, 2, '#e33'); } }), box(0.08, 0.05, 0.9, 0.84, 0.15, 0.6, c, { py: (ctx, w, h, t) => screenPaint('tv', 2, c)(ctx, w, h, t) })];
  }
};
add({ id: 'console-retro', name: 'Console retrô 8-bit', cat: 'consoles', price: 35, rarity: 'comum', w: 1, d: 1, place: 'top', use: 'game', model: consoleM('#9d9d9d', 'retro'), collection: 'retro' });
add({ id: 'console-16bit', name: 'Console 16-bit', cat: 'consoles', price: 60, rarity: 'comum', w: 1, d: 1, place: 'top', use: 'game', model: consoleM('#3a3a3a', 'retro'), collection: 'retro' });
add({ id: 'console-portatil', name: 'Console portátil', cat: 'consoles', price: 140, rarity: 'incomum', w: 1, d: 1, place: 'top', use: 'game', model: consoleM('#d33', 'handheld') });
add({ id: 'console-caixa-preto', name: 'Console de mesa preto', cat: 'consoles', price: 260, rarity: 'raro', w: 1, d: 1, place: 'top', use: 'game', model: consoleM('#18181b', 'box'), collection: 'gamer' });
add({ id: 'console-torre-branco', name: 'Console torre branco', cat: 'consoles', price: 320, rarity: 'raro', w: 1, d: 1, place: 'top', use: 'game', model: consoleM('#eeeef2', 'tall'), collection: 'gamer' });
add({ id: 'console-torre-preto', name: 'Console torre preto', cat: 'consoles', price: 320, rarity: 'raro', w: 1, d: 1, place: 'top', use: 'game', model: consoleM('#1b1b1f', 'tall') });
add({ id: 'oculos-vr', name: 'Óculos de realidade virtual', cat: 'consoles', price: 480, rarity: 'epico', w: 1, d: 1, place: 'top', use: 'game', model: consoleM('#f2f2f2', 'vr') });
variants(['red', 'blue', 'purple'], (c, n) => add({ id: `fliperama-${n}`, name: `Máquina de fliperama (${COLOR_LABEL[n]})`, cat: 'consoles', price: 850, rarity: 'epico', w: 1, d: 1, place: 'floor', use: 'game', model: consoleM(c, 'arcade'), minLevel: 7, collection: 'retro' }));
add({ id: 'pinball', name: 'Mesa de pinball', cat: 'consoles', price: 1700, rarity: 'lendario', w: 1, d: 2, place: 'floor', use: 'game', model: consoleM('#8e1fbf', 'pinball'), minLevel: 11, collection: 'retro' });
add({ id: 'mesa-sinuca', name: 'Mesa de sinuca', cat: 'consoles', price: 1400, rarity: 'epico', w: 3, d: 2, place: 'floor', use: 'game', minLevel: 10, model: () => [box(0.3, 0.3, 0, 0.3, 0.3, 0.6, PALETTE.darkwood), box(2.4, 0.3, 0, 0.3, 0.3, 0.6, PALETTE.darkwood), box(0.3, 1.4, 0, 0.3, 0.3, 0.6, PALETTE.darkwood), box(2.4, 1.4, 0, 0.3, 0.3, 0.6, PALETTE.darkwood), box(0.1, 0.1, 0.6, 2.8, 1.8, 0.2, PALETTE.darkwood, { top: (ctx, w, h) => { rect(ctx, 0, 0, w, h, PALETTE.darkwood); rect(ctx, 5, 5, w - 10, h - 10, '#1f7a46'); [[6, 6], [w / 2, 5], [w - 6, 6], [6, h - 6], [w / 2, h - 5], [w - 6, h - 6]].forEach(([x, y]) => { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }); ['#fff', '#e33', '#fd3', '#33e', '#111'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(w * 0.6 + (i % 3) * 5, h * 0.4 + Math.floor(i / 3) * 5, 2, 0, 7); ctx.fill(); }); } })] });
add({ id: 'pebolim', name: 'Pebolim', cat: 'consoles', price: 600, rarity: 'raro', w: 2, d: 1, place: 'floor', use: 'game', model: () => [...legs4(0.15, 0.15, 1.7, 0.7, 0.6, '#333'), box(0.1, 0.1, 0.6, 1.8, 0.8, 0.3, '#2563eb', { top: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#2563eb'); rect(ctx, 4, 4, w - 8, h - 8, '#2f9e4f'); for (let i = 1; i < 6; i++) rect(ctx, (w / 6) * i, 0, 1, h, '#ccc'); } })] });

/* ===================== COZINHA ===================== */

const coffee = (c: string, kind: 'pot' | 'electric' | 'capsule' | 'espresso' | 'pro'): () => Prim[] => () => {
  const steam = spr(0.5, 0.5, kind === 'pro' ? 0.55 : 0.4, (ctx, t) => { ctx.fillStyle = 'rgba(255,255,255,0.4)'; for (let i = 0; i < 3; i++) { const y = -((t * 8 + i * 6) % 16); ctx.fillRect(-1 + Math.sin(t * 2 + i) * 2, y, 2, 2); } }, 0.1, 0.3);
  switch (kind) {
    case 'pot': return [box(0.4, 0.4, 0, 0.2, 0.2, 0.22, '#e6e1d5'), box(0.38, 0.38, 0.22, 0.24, 0.24, 0.05, '#b0623d'), steam];
    case 'electric': return [box(0.3, 0.3, 0, 0.4, 0.35, 0.05, c), box(0.3, 0.3, 0.05, 0.12, 0.35, 0.35, c), box(0.48, 0.42, 0.05, 0.18, 0.18, 0.18, 'rgba(60,30,10,0.85)'), box(0.3, 0.3, 0.4, 0.4, 0.35, 0.06, c), steam];
    case 'capsule': return [box(0.33, 0.3, 0, 0.34, 0.45, 0.35, c, { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); rect(ctx, w / 2 - 3, h * 0.5, 6, h * 0.4, '#222'); } }), steam];
    case 'espresso': return [box(0.2, 0.3, 0, 0.6, 0.45, 0.42, c, { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); rect(ctx, 4, h * 0.45, w - 8, h * 0.45, '#2b2b2b'); rect(ctx, w * 0.45, h * 0.4, 4, 5, '#888'); rect(ctx, 4, 3, 6, 6, '#ddd'); } }), steam];
    case 'pro': return [box(0.05, 0.25, 0, 0.9, 0.55, 0.5, c, { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); for (let i = 0; i < 2; i++) { rect(ctx, 6 + i * (w / 2), h * 0.45, w / 2 - 12, h * 0.45, '#222'); rect(ctx, 6 + i * (w / 2) + w / 4 - 8, h * 0.4, 4, 6, PALETTE.gold); } rect(ctx, 0, 0, w, 3, PALETTE.gold); } }), steam];
  }
};
add({ id: 'cafe-coador', name: 'Coador de pano na garrafa', cat: 'cozinha', price: 6, rarity: 'sucata', w: 1, d: 1, place: 'top', use: 'coffee', model: coffee('#e6e1d5', 'pot') });
add({ id: 'cafeteira-eletrica', name: 'Cafeteira elétrica', cat: 'cozinha', price: 35, rarity: 'comum', w: 1, d: 1, place: 'top', use: 'coffee', model: coffee('#2b2b2b', 'electric') });
variants(['red', 'black', 'white'], (c, n) => add({ id: `cafeteira-capsula-${n}`, name: `Cafeteira de cápsula (${COLOR_LABEL[n]})`, cat: 'cozinha', price: 90, rarity: 'incomum', w: 1, d: 1, place: 'top', use: 'coffee', model: coffee(c, 'capsule') }));
add({ id: 'cafeteira-espresso', name: 'Máquina de espresso', cat: 'cozinha', price: 320, rarity: 'raro', w: 1, d: 1, place: 'top', use: 'coffee', model: coffee('#c0c6d0', 'espresso') });
add({ id: 'cafeteira-pro', name: 'Máquina de café profissional', cat: 'cozinha', price: 1300, rarity: 'epico', w: 1, d: 1, place: 'top', use: 'coffee', model: coffee('#b9c0cc', 'pro'), minLevel: 9, collection: 'ceo' });
const fridge = (c: string, kind: 'mini' | 'retro' | 'beer' | 'duplex' | 'smart'): () => Prim[] => () => {
  switch (kind) {
    case 'mini': return [box(0.15, 0.15, 0, 0.7, 0.7, 0.85, c, { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); rect(ctx, 3, 3, w - 6, h - 6, shade(c, -0.05)); rect(ctx, w - 7, 6, 2, 10, '#888'); } })];
    case 'retro': return [box(0.15, 0.15, 0, 0.7, 0.7, 1.0, c, { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); rect(ctx, 0, 0, w, 3, shade(c, 0.2)); rect(ctx, w - 8, 8, 3, 14, '#ddd'); rect(ctx, w / 2 - 5, 3, 10, 2, '#ddd'); } })];
    case 'beer': return [box(0.15, 0.15, 0, 0.7, 0.7, 1.0, c, { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); rect(ctx, 3, 3, w - 6, h - 6, 'rgba(120,180,255,0.35)'); for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) rect(ctx, 5 + k * 5, 6 + r * 7, 3, 5, '#d9a441'); } })];
    case 'duplex': return [box(0.1, 0.15, 0, 0.8, 0.75, 1.9, c, { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, c); rect(ctx, 0, h * 0.3, w, 2, shade(c, -0.3)); rect(ctx, w - 6, 8, 2, 8, '#999'); rect(ctx, w - 6, h * 0.35, 2, 20, '#999'); } })];
    case 'smart': return [box(0.05, 0.15, 0, 1.9, 0.75, 1.9, c, { py: (ctx, w, h, t) => { rect(ctx, 0, 0, w, h, c); rect(ctx, w / 2 - 1, 0, 2, h, shade(c, -0.3)); screenPaint('finance', 1, '#111')(ctx, w * 0.3, h * 0.2, t); } })];
  }
};
add({ id: 'frigobar-velho', name: 'Frigobar velho enferrujado', cat: 'cozinha', price: 20, rarity: 'sucata', w: 1, d: 1, place: 'floor', use: 'fridge', surface: 0.85, model: fridge('#d9d4c4', 'mini') });
variants(['white', 'black', 'silver'], (c, n) => add({ id: `frigobar-${n}`, name: `Frigobar (${COLOR_LABEL[n]})`, cat: 'cozinha', price: 80, rarity: 'comum', w: 1, d: 1, place: 'floor', use: 'fridge', surface: 0.85, model: fridge(c, 'mini') }));
variants(['red', 'teal', 'pink'], (c, n) => add({ id: `frigobar-retro-${n}`, name: `Frigobar retrô (${COLOR_LABEL[n]})`, cat: 'cozinha', price: 220, rarity: 'raro', w: 1, d: 1, place: 'floor', use: 'fridge', surface: 1.0, model: fridge(c, 'retro'), collection: n === 'pink' ? 'kawaii' : 'retro' }));
add({ id: 'cervejeira', name: 'Cervejeira de porta de vidro', cat: 'cozinha', price: 300, rarity: 'raro', w: 1, d: 1, place: 'floor', use: 'fridge', model: fridge('#222', 'beer') });
add({ id: 'geladeira-duplex', name: 'Geladeira duplex', cat: 'cozinha', price: 480, rarity: 'raro', w: 1, d: 1, place: 'floor', use: 'fridge', model: fridge('#d5d9e0', 'duplex') });
add({ id: 'geladeira-smart', name: 'Geladeira smart side-by-side', cat: 'cozinha', price: 1600, rarity: 'epico', w: 2, d: 1, place: 'floor', use: 'fridge', model: fridge('#a9b0bb', 'smart'), minLevel: 10 });
add({ id: 'microondas', name: 'Micro-ondas', cat: 'cozinha', price: 60, rarity: 'comum', w: 1, d: 1, place: 'top', model: () => [box(0.15, 0.25, 0, 0.7, 0.5, 0.35, '#e8e8ec', { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#e8e8ec'); rect(ctx, 3, 3, w * 0.65, h - 6, '#2b2b2b'); rect(ctx, w * 0.75, 4, 5, 3, '#4ade80'); } })] });
add({ id: 'bebedouro', name: 'Bebedouro de galão', cat: 'cozinha', price: 70, rarity: 'comum', w: 1, d: 1, place: 'floor', use: 'water', model: () => [box(0.25, 0.25, 0, 0.5, 0.5, 0.9, '#eef0f4', { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#eef0f4'); rect(ctx, 4, h * 0.25, 4, 4, '#3b82f6'); rect(ctx, w - 8, h * 0.25, 4, 4, '#ef4444'); } }), box(0.3, 0.3, 0.9, 0.4, 0.4, 0.45, 'rgba(120,190,255,0.6)', { glass: true })] });

/* ===================== COLECIONÁVEIS ===================== */

add({ id: 'cofrinho-porco', name: 'Cofrinho de porquinho', cat: 'colecionaveis', price: 15, rarity: 'comum', w: 1, d: 1, place: 'top', use: 'money', model: () => [spr(0.5, 0.5, 0, (ctx) => { ctx.fillStyle = '#f29bb8'; ctx.fillRect(-7, -9, 14, 8); ctx.fillRect(-9, -7, 2, 4); ctx.fillRect(-6, -1, 2, 2); ctx.fillRect(4, -1, 2, 2); ctx.fillStyle = '#d97895'; ctx.fillRect(-11, -7, 2, 3); ctx.fillStyle = '#222'; ctx.fillRect(-2, -10, 4, 1); ctx.fillRect(-6, -7, 1, 1); }, 0.15, 0.3)], desc: 'O começo de todo império.' });
add({ id: 'cofrinho-dourado', name: 'Cofrinho dourado', cat: 'colecionaveis', price: 600, rarity: 'epico', w: 1, d: 1, place: 'top', use: 'money', model: () => [spr(0.5, 0.5, 0, (ctx, t) => { ctx.fillStyle = Math.sin(t * 2) > 0.8 ? '#fff1a8' : '#e2b53f'; ctx.fillRect(-7, -9, 14, 8); ctx.fillRect(-9, -7, 2, 4); ctx.fillRect(-6, -1, 2, 2); ctx.fillRect(4, -1, 2, 2); ctx.fillStyle = '#b8862b'; ctx.fillRect(-11, -7, 2, 3); ctx.fillRect(-2, -10, 4, 1); }, 0.15, 0.3)], collection: 'imperio', minLevel: 8 });
const trophy = (c: string, size: number): () => Prim[] => () => [box(0.38, 0.38, 0, 0.24, 0.24, 0.08, '#3a2a1a'), spr(0.5, 0.5, 0.08, (ctx, t) => { const s = size; ctx.fillStyle = c; ctx.fillRect(-1, -6 * s, 2, 6 * s); ctx.fillRect(-4 * s, -12 * s, 8 * s, 6 * s); ctx.fillRect(-6 * s, -11 * s, 2 * s, 3 * s); ctx.fillRect(4 * s, -11 * s, 2 * s, 3 * s); if (Math.sin(t * 2) > 0.7) { ctx.fillStyle = '#fff'; ctx.fillRect(-2 * s, -11 * s, 1, 2); } }, 0.12, 0.5)];
add({ id: 'trofeu-bronze', name: 'Troféu de bronze', cat: 'colecionaveis', price: 40, rarity: 'comum', w: 1, d: 1, place: 'top', model: trophy('#c07a3a', 1), collection: 'trofeus' });
add({ id: 'trofeu-prata', name: 'Troféu de prata', cat: 'colecionaveis', price: 120, rarity: 'incomum', w: 1, d: 1, place: 'top', model: trophy('#c9ced6', 1.15), collection: 'trofeus' });
add({ id: 'trofeu-ouro', name: 'Troféu de ouro', cat: 'colecionaveis', price: 400, rarity: 'raro', w: 1, d: 1, place: 'top', model: trophy('#e2b53f', 1.3), collection: 'trofeus' });
add({ id: 'trofeu-diamante', name: 'Troféu de diamante', cat: 'colecionaveis', price: 2000, rarity: 'lendario', w: 1, d: 1, place: 'top', model: trophy('#9ee7ff', 1.5), collection: 'trofeus', minLevel: 15 });
add({ id: 'globo', name: 'Globo terrestre', cat: 'colecionaveis', price: 70, rarity: 'incomum', w: 1, d: 1, place: 'top', model: () => [box(0.4, 0.4, 0, 0.2, 0.2, 0.05, PALETTE.darkwood), spr(0.5, 0.5, 0.05, (ctx, t) => { ctx.fillStyle = '#2f6fa6'; ctx.beginPath(); ctx.arc(0, -10, 7, 0, 7); ctx.fill(); ctx.fillStyle = '#69a85a'; const o = (t * 4) % 14 - 7; ctx.fillRect(o - 2, -14, 4, 3); ctx.fillRect(o + 2, -9, 3, 4); ctx.strokeStyle = PALETTE.gold; ctx.beginPath(); ctx.arc(0, -10, 8, -1.2, 2); ctx.stroke(); }, 0.15, 0.5)] });
add({ id: 'aquario', name: 'Aquário', cat: 'colecionaveis', price: 260, rarity: 'raro', w: 2, d: 1, place: 'floor', model: () => [box(0.1, 0.25, 0, 1.8, 0.5, 0.7, '#2b2b2b'), box(0.1, 0.25, 0.7, 1.8, 0.5, 0.6, 'rgba(80,170,255,0.45)', { glass: true, py: (ctx, w, h, t) => { rect(ctx, 0, 0, w, h, 'rgba(60,150,230,0.35)'); rect(ctx, 0, h - 4, w, 4, '#d9c08a'); for (let i = 0; i < 4; i++) { const x = (t * (8 + i * 3) + i * 20) % (w + 10) - 5; rect(ctx, x, 6 + i * 4, 5, 3, ['#ff8c42', '#ffd23f', '#ee4266', '#3bceac'][i]); } ctx.fillStyle = '#2f8f46'; ctx.fillRect(6, h - 14, 2, 10); ctx.fillRect(w - 10, h - 12, 2, 8); } }), box(0.08, 0.23, 1.3, 1.84, 0.54, 0.05, '#2b2b2b')] });
add({ id: 'action-figure', name: 'Action figure na caixa', cat: 'colecionaveis', price: 50, rarity: 'incomum', w: 1, d: 1, place: 'top', model: () => [box(0.35, 0.4, 0, 0.3, 0.12, 0.42, '#d33', { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#d33'); rect(ctx, 2, 4, w - 4, h - 8, 'rgba(200,230,255,0.6)'); rect(ctx, w / 2 - 2, 6, 4, 4, '#f2c08a'); rect(ctx, w / 2 - 3, 10, 6, 6, '#2f6fd1'); } })], collection: 'gamer' });
add({ id: 'foguete-lego', name: 'Foguete de blocos', cat: 'colecionaveis', price: 180, rarity: 'raro', w: 1, d: 1, place: 'top', model: () => [box(0.42, 0.42, 0, 0.16, 0.16, 0.5, '#eee'), box(0.38, 0.38, 0, 0.24, 0.24, 0.1, '#d33'), box(0.45, 0.45, 0.5, 0.1, 0.1, 0.1, '#d33')], collection: 'futuro' });
add({ id: 'estatua-touro', name: 'Estátua do touro de Wall Street', cat: 'colecionaveis', price: 1500, rarity: 'lendario', w: 1, d: 1, place: 'top', minLevel: 12, collection: 'imperio', model: () => [box(0.2, 0.3, 0, 0.6, 0.4, 0.06, '#222'), spr(0.5, 0.5, 0.06, (ctx) => { ctx.fillStyle = '#b8862b'; ctx.fillRect(-10, -10, 18, 7); ctx.fillRect(-9, -3, 2, 3); ctx.fillRect(4, -3, 2, 3); ctx.fillRect(8, -13, 5, 6); ctx.fillStyle = '#e2b53f'; ctx.fillRect(12, -16, 1, 3); ctx.fillRect(9, -16, 1, 3); ctx.fillRect(-10, -10, 18, 1); }, 0.25, 0.4)] });
add({ id: 'diploma', name: 'Diploma emoldurado', cat: 'paredes', price: 30, rarity: 'comum', w: 1, d: 1, place: 'wall', wallH: 0.45, wallZ: 1.4, wallPaint: framePaint((ctx, w, h) => { rect(ctx, 0, 0, w, h, '#f6f0dd'); for (let y = 4; y < h - 3; y += 3) rect(ctx, 3, y, w - 6, 1, '#b9ad8c'); rect(ctx, w / 2 - 2, h - 5, 4, 4, '#c0392b'); }, PALETTE.darkwood), collection: 'ceo' });
add({ id: 'relogio-parede', name: 'Relógio de parede', cat: 'paredes', price: 25, rarity: 'comum', w: 1, d: 1, place: 'wall', wallH: 0.4, wallZ: 1.7, wallPaint: (ctx, w, h) => { const now = new Date(); ctx.fillStyle = '#222'; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.32, h * 0.45, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#f5f5f0'; ctx.beginPath(); ctx.ellipse(w / 2, h / 2, w * 0.28, h * 0.4, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2; const hr = ((now.getHours() % 12) + now.getMinutes() / 60) / 12 * Math.PI * 2; const mn = now.getMinutes() / 60 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 + Math.sin(hr) * w * 0.14, h / 2 - Math.cos(hr) * h * 0.2); ctx.moveTo(w / 2, h / 2); ctx.lineTo(w / 2 + Math.sin(mn) * w * 0.22, h / 2 - Math.cos(mn) * h * 0.32); ctx.stroke(); } });
add({ id: 'lava-lampada-gigante', name: 'Placa neon "$$$"', cat: 'paredes', price: 340, rarity: 'raro', w: 2, d: 1, place: 'wall', wallH: 0.5, wallZ: 1.5, wallPaint: (ctx, w, h, t) => { ctx.shadowColor = '#3bff8a'; ctx.shadowBlur = 6; ctx.fillStyle = Math.sin(t * 3) > -0.9 ? '#7dffb0' : '#2a5'; ctx.font = `bold ${Math.floor(h * 0.8)}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$$$', w / 2, h / 2); ctx.shadowBlur = 0; }, collection: 'rgb', light: { color: '#3bff8a', r: 2.5, z: 1.7 } });
add({ id: 'neon-play', name: 'Placa neon de controle', cat: 'paredes', price: 260, rarity: 'raro', w: 1, d: 1, place: 'wall', wallH: 0.5, wallZ: 1.5, wallPaint: (ctx, w, h, t) => { ctx.strokeStyle = hsl(280 + Math.sin(t) * 30, 100, 65); ctx.lineWidth = 2; ctx.strokeRect(w * 0.15, h * 0.25, w * 0.7, h * 0.5); ctx.fillStyle = ctx.strokeStyle as string; ctx.fillRect(w * 0.25, h * 0.45, 6, 2); ctx.fillRect(w * 0.25 + 2, h * 0.45 - 2, 2, 6); ctx.fillRect(w * 0.65, h * 0.4, 3, 3); ctx.fillRect(w * 0.72, h * 0.5, 3, 3); }, collection: 'gamer', light: { color: '#c04bff', r: 2.2, z: 1.7 } });

/* ===================== QUADROS E PÔSTERES ===================== */

const posterNames = ['Pôster de paisagem', 'Pôster abstrato', 'Pôster "Juros compostos"', 'Pôster retrato', 'Pôster gamer', 'Pôster de banda', 'Pôster mapa-múndi', 'Pôster de dinheiro'];
posterNames.forEach((n, i) => add({ id: `poster-${i}`, name: n, cat: 'paredes', price: 8 + i * 2, rarity: 'comum', w: 1, d: 1, place: 'wall', wallH: 0.7, wallZ: 1.1, wallPaint: (ctx, w, h, t) => { artPaint(i, i + 3)(ctx, w, h, t); rect(ctx, 0, 0, 2, 2, '#ccc'); rect(ctx, w - 2, 0, 2, 2, '#ccc'); }, collection: i === 4 ? 'gamer' : undefined }));
add({ id: 'poster-rasgado', name: 'Pôster rasgado de banda', cat: 'paredes', price: 0, rarity: 'sucata', w: 1, d: 1, place: 'wall', wallH: 0.6, wallZ: 1.2, sad: true, wallPaint: (ctx, w, h, t) => { artPaint(5, 9)(ctx, w, h, t); ctx.fillStyle = 'rgba(0,0,0,0)'; ctx.clearRect(w * 0.7, 0, w * 0.3, h * 0.25); ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.moveTo(w, 0); ctx.lineTo(w * 0.6, 0); ctx.lineTo(w, h * 0.4); ctx.fill(); ctx.restore(); } });
const frames: [string, string][] = [['madeira', PALETTE.wood], ['preta', '#1d1d1d'], ['dourada', PALETTE.gold]];
for (let i = 0; i < 8; i++) frames.forEach(([fn, fc], j) => {
  if ((i + j) % 3 === 2) return;
  const big = i % 3 === 0;
  add({ id: `quadro-${i}-${j}`, name: `Quadro ${['de paisagem', 'abstrato', 'gráfico em alta', 'retrato', 'pixel art', 'pop', 'cartográfico', 'cédula'][i]} (moldura ${fn})${big ? ' grande' : ''}`, cat: 'paredes', price: (big ? 90 : 35) + j * 40 + i * 4, rarity: j === 2 ? (big ? 'epico' : 'raro') : big ? 'incomum' : 'comum', w: big ? 2 : 1, d: 1, place: 'wall', wallH: big ? 0.9 : 0.6, wallZ: big ? 1.0 : 1.2, wallPaint: framePaint(artPaint(i, i * 3 + j), fc, 3), collection: j === 2 ? 'ceo' : undefined });
});
add({ id: 'quadro-branco', name: 'Quadro branco de metas', cat: 'escritorio', price: 60, rarity: 'comum', w: 2, d: 1, place: 'wall', wallH: 0.8, wallZ: 1.0, wallPaint: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#c0c4cc'); rect(ctx, 2, 2, w - 4, h - 4, '#fbfbfb'); ctx.strokeStyle = '#2f6fd1'; ctx.beginPath(); ctx.moveTo(6, h - 8); ctx.lineTo(w * 0.3, h * 0.6); ctx.lineTo(w * 0.55, h * 0.65); ctx.lineTo(w - 8, h * 0.2); ctx.stroke(); rect(ctx, 6, 5, 18, 2, '#d33'); rect(ctx, 6, 9, 12, 2, '#333'); } });
add({ id: 'mural-cortica', name: 'Mural de cortiça com contas', cat: 'escritorio', price: 25, rarity: 'comum', w: 1, d: 1, place: 'wall', wallH: 0.6, wallZ: 1.2, wallPaint: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#8b6a3e'); rect(ctx, 2, 2, w - 4, h - 4, '#c49a66'); [['#fff59d', 4, 4], ['#f8bbd0', 16, 8], ['#b3e5fc', 8, 16], ['#fff', 20, 20]].forEach(([c, x, y]) => { rect(ctx, x as number, y as number, 9, 8, c as string); rect(ctx, (x as number) + 4, y as number, 1, 1, '#d33'); }); } });
add({ id: 'calendario-parede', name: 'Calendário de parede', cat: 'escritorio', price: 12, rarity: 'comum', w: 1, d: 1, place: 'wall', wallH: 0.55, wallZ: 1.25, wallPaint: (ctx, w, h) => { rect(ctx, w * 0.2, 0, w * 0.6, h, '#fff'); rect(ctx, w * 0.2, 0, w * 0.6, h * 0.3, '#c0392b'); for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) rect(ctx, w * 0.24 + c * 3.5, h * 0.38 + r * 4, 2, 2, r === 2 && c === 3 ? '#c0392b' : '#999'); } });

/* ===================== JANELAS, PORTAS E CORTINAS ===================== */

add({ id: 'janela-velha', name: 'Janela pequena e velha', cat: 'janelas', price: 0, rarity: 'sucata', w: 1, d: 1, place: 'wall', wallH: 0.7, wallZ: 1.2, sad: true, wallPaint: windowPaint('#8a7a5a', [1, 2], true), light: { color: '#bcd6ff', r: 1.6, z: 1.5 } });
add({ id: 'janela-simples', name: 'Janela simples', cat: 'janelas', price: 30, rarity: 'comum', w: 1, d: 1, place: 'wall', wallH: 0.9, wallZ: 1.0, wallPaint: windowPaint('#f2f2f2', [2, 1]), light: { color: '#cfe3ff', r: 2, z: 1.5 } });
add({ id: 'janela-dupla', name: 'Janela dupla de correr', cat: 'janelas', price: 70, rarity: 'incomum', w: 2, d: 1, place: 'wall', wallH: 1.0, wallZ: 1.0, wallPaint: windowPaint('#e9e9e9', [4, 1]), light: { color: '#cfe3ff', r: 2.6, z: 1.5 } });
add({ id: 'janela-madeira', name: 'Janela de madeira com cortina', cat: 'janelas', price: 95, rarity: 'incomum', w: 2, d: 1, place: 'wall', wallH: 1.1, wallZ: 0.9, wallPaint: windowPaint(PALETTE.wood, [2, 2], false, '#c95b4b'), light: { color: '#ffe4c4', r: 2.6, z: 1.5 } });
add({ id: 'janela-panoramica', name: 'Janela panorâmica', cat: 'janelas', price: 380, rarity: 'raro', w: 3, d: 1, place: 'wall', wallH: 1.7, wallZ: 0.4, wallPaint: windowPaint('#2b2b2b', [3, 1]), light: { color: '#d7e8ff', r: 4, z: 1.5 } });
add({ id: 'janela-vitral', name: 'Vitral colorido', cat: 'janelas', price: 520, rarity: 'epico', w: 1, d: 1, place: 'wall', wallH: 1.3, wallZ: 0.9, wallPaint: (ctx, w, h, t) => { const cols = ['#e63946', '#f1c40f', '#2a9d8f', '#457b9d', '#9b5de5']; for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) rect(ctx, c * w / 3, r * h / 6, w / 3, h / 6, cols[(r + c + Math.floor(t / 3)) % 5]); ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.strokeRect(1, 1, w - 2, h - 2); for (let c = 1; c < 3; c++) { ctx.beginPath(); ctx.moveTo(c * w / 3, 0); ctx.lineTo(c * w / 3, h); ctx.stroke(); } }, light: { color: '#f3c4ff', r: 2.5, z: 1.5 } });
const curtain = (c: string, kind: 'plain' | 'blinds' | 'velvet'): Paint => (ctx, w, h) => {
  rect(ctx, 0, 0, w, 2, '#444');
  if (kind === 'blinds') { for (let y = 2; y < h; y += 3) { rect(ctx, 1, y, w - 2, 2, c); rect(ctx, 1, y + 2, w - 2, 1, shade(c, -0.2)); } return; }
  rect(ctx, 0, 2, w * 0.35, h - 2, c); rect(ctx, w * 0.65, 2, w * 0.35, h - 2, c);
  ctx.fillStyle = shade(c, -0.25);
  for (let x = 2; x < w * 0.35; x += 4) { ctx.fillRect(x, 2, 1, h); ctx.fillRect(w - x, 2, 1, h); }
  if (kind === 'velvet') { rect(ctx, 0, 2, w, 4, shade(c, -0.1)); rect(ctx, w * 0.3, h * 0.5, 3, 4, PALETTE.gold); rect(ctx, w * 0.67, h * 0.5, 3, 4, PALETTE.gold); }
};
add({ id: 'cortina-lencol', name: 'Lençol pendurado como cortina', cat: 'janelas', price: 4, rarity: 'sucata', w: 1, d: 1, place: 'wall', wallH: 1.0, wallZ: 1.0, wallPaint: curtain('#9cb4d4', 'plain') });
variants(['beige', 'blue', 'green', 'red'], (c, n) => add({ id: `cortina-${n}`, name: `Cortina (${COLOR_LABEL[n]})`, cat: 'janelas', price: 35, rarity: 'comum', w: 1, d: 1, place: 'wall', wallH: 1.3, wallZ: 0.8, wallPaint: curtain(c, 'plain') }));
add({ id: 'persiana', name: 'Persiana horizontal', cat: 'janelas', price: 55, rarity: 'incomum', w: 1, d: 1, place: 'wall', wallH: 1.1, wallZ: 1.0, wallPaint: curtain('#e7e3da', 'blinds') });
add({ id: 'cortina-veludo', name: 'Cortina de veludo', cat: 'janelas', price: 380, rarity: 'epico', w: 2, d: 1, place: 'wall', wallH: 1.9, wallZ: 0.3, wallPaint: curtain('#7a1f2b', 'velvet'), collection: 'imperio' });
const doorPaint = (c: string, kind: 'old' | 'basic' | 'glass' | 'double' | 'vault'): Paint => (ctx, w, h) => {
  if (kind === 'glass') { rect(ctx, 0, 0, w, h, '#555'); rect(ctx, 2, 2, w - 4, h - 2, 'rgba(160,210,255,0.6)'); rect(ctx, w - 6, h * 0.5, 2, 8, '#ddd'); return; }
  if (kind === 'vault') { rect(ctx, 0, 0, w, h, '#4a505c'); ctx.fillStyle = '#6b7280'; ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.4, 0, 7); ctx.fill(); ctx.fillStyle = PALETTE.gold; ctx.beginPath(); ctx.arc(w / 2, h / 2, 4, 0, 7); ctx.fill(); return; }
  rect(ctx, 0, 0, w, h, shade(c, -0.25));
  const n = kind === 'double' ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const x0 = 2 + i * (w - 4) / n, ww = (w - 4) / n - 1;
    rect(ctx, x0, 2, ww, h - 2, c);
    rect(ctx, x0 + 3, 6, ww - 6, h * 0.35, shade(c, -0.1));
    rect(ctx, x0 + 3, h * 0.5, ww - 6, h * 0.42, shade(c, -0.1));
    rect(ctx, i === 0 ? x0 + ww - 5 : x0 + 2, h * 0.5, 3, 2, '#d9c38f');
  }
  if (kind === 'old') { rect(ctx, 6, h * 0.3, 8, 3, 'rgba(0,0,0,0.25)'); rect(ctx, w * 0.5, h * 0.75, 6, 6, 'rgba(0,0,0,0.2)'); }
};
add({ id: 'porta-velha', name: 'Porta velha descascada', cat: 'janelas', price: 0, rarity: 'sucata', w: 1, d: 1, place: 'wall', wallH: 2.0, wallZ: 0, sad: true, wallPaint: doorPaint('#8b5e3c', 'old') });
add({ id: 'porta-branca', name: 'Porta branca', cat: 'janelas', price: 40, rarity: 'comum', w: 1, d: 1, place: 'wall', wallH: 2.0, wallZ: 0, wallPaint: doorPaint('#efefea', 'basic') });
add({ id: 'porta-madeira', name: 'Porta de madeira maciça', cat: 'janelas', price: 120, rarity: 'incomum', w: 1, d: 1, place: 'wall', wallH: 2.0, wallZ: 0, wallPaint: doorPaint(PALETTE.wood, 'basic') });
add({ id: 'porta-vidro', name: 'Porta de vidro', cat: 'janelas', price: 260, rarity: 'raro', w: 1, d: 1, place: 'wall', wallH: 2.1, wallZ: 0, wallPaint: doorPaint('#555', 'glass') });
add({ id: 'porta-dupla', name: 'Porta dupla executiva', cat: 'janelas', price: 700, rarity: 'epico', w: 2, d: 1, place: 'wall', wallH: 2.3, wallZ: 0, wallPaint: doorPaint(PALETTE.mahogany, 'double'), minLevel: 9, collection: 'ceo' });
add({ id: 'porta-cofre', name: 'Porta de cofre de banco', cat: 'janelas', price: 3000, rarity: 'lendario', w: 2, d: 1, place: 'wall', wallH: 2.2, wallZ: 0, wallPaint: doorPaint('#555', 'vault'), minLevel: 15, collection: 'imperio' });
add({ id: 'prateleira-parede', name: 'Prateleira de parede com livros', cat: 'estantes', price: 28, rarity: 'comum', w: 1, d: 1, place: 'wall', wallH: 0.4, wallZ: 1.4, wallPaint: (ctx, w, h) => { booksPaint(1, PALETTE.wood, 4)(ctx, w, h, 0); } });
add({ id: 'prateleira-parede-dupla', name: 'Prateleiras de parede duplas', cat: 'estantes', price: 70, rarity: 'incomum', w: 2, d: 1, place: 'wall', wallH: 0.8, wallZ: 1.2, wallPaint: (ctx, w, h) => { booksPaint(2, '#f2f2f2', 6)(ctx, w, h, 0); } });

/* ===================== ESCRITÓRIO ===================== */

add({ id: 'impressora', name: 'Impressora multifuncional', cat: 'escritorio', price: 65, rarity: 'comum', w: 1, d: 1, place: 'top', use: 'print', model: () => [box(0.15, 0.2, 0, 0.7, 0.55, 0.3, '#e8e8ec', { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#e8e8ec'); rect(ctx, 4, h * 0.6, w - 8, 3, '#333'); rect(ctx, w - 8, 3, 4, 2, '#4ade80'); } }), box(0.25, 0.15, 0.3, 0.5, 0.15, 0.12, '#fff')] });
add({ id: 'rack-servidores', name: 'Rack de servidores', cat: 'escritorio', price: 1200, rarity: 'epico', w: 1, d: 1, place: 'floor', minLevel: 10, collection: 'futuro', model: () => [box(0.1, 0.1, 0, 0.8, 0.8, 2.1, '#1b1d24', { py: (ctx, w, h, t) => { rect(ctx, 0, 0, w, h, '#1b1d24'); for (let i = 0; i < 14; i++) { rect(ctx, 2, 3 + i * 4.7, w - 4, 3.6, '#2a2e38'); for (let k = 0; k < 3; k++) rect(ctx, w - 12 + k * 3, 4 + i * 4.7, 1.5, 1.5, Math.sin(t * (5 + k) + i * 3) > 0.2 ? ['#4ade80', '#60a5fa', '#fbbf24'][k] : '#222'); } } })], light: { color: '#3b82f6', r: 1.6, z: 1 } });
add({ id: 'divisoria', name: 'Divisória de baia', cat: 'escritorio', price: 45, rarity: 'comum', w: 2, d: 1, place: 'floor', model: () => [box(0.02, 0.45, 0, 1.96, 0.08, 1.2, '#7c8798', { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#7c8798'); rect(ctx, 3, 3, w - 6, h - 6, '#8d97a7'); } })] });
add({ id: 'catraca-cafe', name: 'Carrinho de café e lanches', cat: 'escritorio', price: 210, rarity: 'raro', w: 1, d: 1, place: 'floor', use: 'coffee', model: () => [...legs4(0.15, 0.15, 0.7, 0.7, 0.8, '#888'), box(0.12, 0.12, 0.8, 0.76, 0.76, 0.05, '#c0c6d0'), box(0.12, 0.12, 0.3, 0.76, 0.76, 0.04, '#c0c6d0'), box(0.25, 0.3, 0.85, 0.2, 0.2, 0.2, '#222'), box(0.55, 0.4, 0.85, 0.25, 0.2, 0.1, '#f5c26b')] });
add({ id: 'plaquinha-ceo', name: 'Plaquinha "CEO" de mesa', cat: 'escritorio', price: 80, rarity: 'incomum', w: 1, d: 1, place: 'top', collection: 'ceo', model: () => [box(0.3, 0.7, 0, 0.4, 0.1, 0.1, '#2b2b2b', { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#2b2b2b'); ctx.fillStyle = PALETTE.gold; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('CEO', w / 2, h / 2 + 1); } })] });
add({ id: 'pilha-papeis', name: 'Pilha de papéis e boletos', cat: 'escritorio', price: 2, rarity: 'sucata', w: 1, d: 1, place: 'top', model: () => [box(0.25, 0.5, 0, 0.35, 0.28, 0.12, '#f4f4ee', { py: stripesPaint('#f4f4ee', '#ddd', 1) }), box(0.3, 0.52, 0.12, 0.3, 0.25, 0.04, '#fdf6d8')] });
add({ id: 'calculadora', name: 'Calculadora de mesa', cat: 'escritorio', price: 6, rarity: 'comum', w: 1, d: 1, place: 'top', model: () => [box(0.65, 0.55, 0, 0.18, 0.24, 0.03, '#444', { top: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#444'); rect(ctx, 1, 1, w - 2, 4, '#b6d7a8'); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) rect(ctx, 1 + c * 2, 6 + r * 2, 1, 1, '#ddd'); } })] });
add({ id: 'caneca', name: 'Caneca "Rumo ao primeiro milhão"', cat: 'escritorio', price: 4, rarity: 'comum', w: 1, d: 1, place: 'top', use: 'coffee', model: () => [box(0.7, 0.3, 0, 0.12, 0.12, 0.13, '#f4f4f4', { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#f4f4f4'); rect(ctx, 1, h / 2 - 1, w - 2, 2, '#2e9e5b'); } })] });
add({ id: 'lixeira', name: 'Lixeira de escritório', cat: 'escritorio', price: 5, rarity: 'comum', w: 1, d: 1, place: 'floor', model: () => [box(0.35, 0.35, 0, 0.3, 0.3, 0.38, '#6b7280', { py: stripesPaint('#6b7280', '#4b5563', 2) })] });
add({ id: 'extintor', name: 'Extintor de incêndio', cat: 'escritorio', price: 15, rarity: 'comum', w: 1, d: 1, place: 'floor', model: () => [box(0.4, 0.4, 0, 0.2, 0.2, 0.55, '#c0392b'), box(0.45, 0.45, 0.55, 0.1, 0.1, 0.08, '#222')] });
add({ id: 'recepcao', name: 'Balcão de recepção', cat: 'escritorio', price: 1100, rarity: 'epico', w: 3, d: 1, place: 'floor', surface: 1.05, minLevel: 9, model: () => [box(0.05, 0.1, 0, 2.9, 0.8, 1.05, '#e9e6df', { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#e9e6df'); rect(ctx, 0, h * 0.35, w, 3, PALETTE.gold); ctx.fillStyle = '#555'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText('IMPÉRIO S.A.', w / 2, h * 0.7); } })] });
add({ id: 'catraca', name: 'Catraca de acesso', cat: 'escritorio', price: 600, rarity: 'raro', w: 1, d: 1, place: 'floor', minLevel: 11, model: () => [box(0.1, 0.35, 0, 0.25, 0.3, 1.0, '#9aa0aa'), box(0.65, 0.35, 0, 0.25, 0.3, 1.0, '#9aa0aa'), box(0.35, 0.45, 0.8, 0.3, 0.1, 0.04, '#4ade80')] });
add({ id: 'escultura-moderna', name: 'Escultura moderna', cat: 'colecionaveis', price: 880, rarity: 'epico', w: 1, d: 1, place: 'floor', minLevel: 10, model: () => [box(0.25, 0.25, 0, 0.5, 0.5, 0.6, '#e9e6df'), box(0.35, 0.35, 0.6, 0.3, 0.3, 0.5, '#d33'), box(0.42, 0.3, 1.1, 0.15, 0.4, 0.3, '#2f6fd1')] });
add({ id: 'piano', name: 'Piano de cauda', cat: 'colecionaveis', price: 4800, rarity: 'lendario', w: 2, d: 2, place: 'floor', use: 'music', minLevel: 18, collection: 'imperio', model: () => [box(0.3, 0.3, 0, 0.12, 0.12, 0.7, '#111'), box(1.6, 0.3, 0, 0.12, 0.12, 0.7, '#111'), box(1.0, 1.5, 0, 0.12, 0.12, 0.7, '#111'), box(0.1, 0.1, 0.7, 1.8, 1.6, 0.3, '#151515', { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#151515'); for (let x = 2; x < w - 2; x += 3) rect(ctx, x, 1, 2, h * 0.6, '#f4f4f4'); for (let x = 3; x < w - 3; x += 6) rect(ctx, x, 1, 1.5, h * 0.35, '#111'); } }), box(0.1, 0.1, 1.0, 1.8, 0.2, 0.6, '#151515')] });

/* ===================== ITENS DE EVENTO (só à venda durante o evento) ===================== */

add({ id: 'ev-cofrinho-verde', name: 'Cofrinho de Outubro (edição limitada)', cat: 'colecionaveis', price: 45, rarity: 'raro', w: 1, d: 1, place: 'top', use: 'money', event: 'ev-cofrinho', model: () => [spr(0.5, 0.5, 0, (ctx, t) => { ctx.fillStyle = '#4ade80'; ctx.fillRect(-7, -9, 14, 8); ctx.fillRect(-9, -7, 2, 4); ctx.fillRect(-6, -1, 2, 2); ctx.fillRect(4, -1, 2, 2); ctx.fillStyle = '#15803d'; ctx.fillRect(-2, -10, 4, 1); ctx.fillStyle = Math.sin(t * 3) > 0 ? '#fde047' : '#eab308'; ctx.fillRect(-2, -14 - Math.abs(Math.sin(t * 2)) * 3, 4, 3); }, 0.15, 0.4)] });
add({ id: 'ev-planner', name: 'Planner de Janeiro', cat: 'escritorio', price: 30, rarity: 'raro', w: 1, d: 1, place: 'top', event: 'ev-janeiro', model: () => [box(0.3, 0.5, 0, 0.4, 0.3, 0.05, '#2f6fd1', { top: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#2f6fd1'); rect(ctx, 2, 2, w - 4, h - 4, '#f4f4f4'); for (let y = 4; y < h - 2; y += 2) rect(ctx, 3, y, w - 6, 1, '#bbb'); } })] });
add({ id: 'ev-sacola', name: 'Sacola "Não comprei por impulso"', cat: 'colecionaveis', price: 35, rarity: 'raro', w: 1, d: 1, place: 'floor', event: 'ev-blackfriday', model: () => [box(0.3, 0.35, 0, 0.4, 0.25, 0.45, '#111', { py: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#111'); ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.fillText('NÃO!', w / 2, h / 2 + 2); } })] });
add({ id: 'ev-arvore-natal', name: 'Árvore de Natal econômica', cat: 'plantas', price: 60, rarity: 'raro', w: 1, d: 1, place: 'floor', event: 'ev-dezembro', light: { color: '#ffd36b', r: 2.2, z: 1 }, model: () => [box(0.4, 0.4, 0, 0.2, 0.2, 0.2, '#8b5a2b'), spr(0.5, 0.5, 0.2, (ctx, t) => { ctx.fillStyle = '#1f7a3a'; for (let i = 0; i < 4; i++) ctx.fillRect(-14 + i * 3, -10 - i * 10, 28 - i * 6, 10); ctx.fillStyle = '#fbbf24'; ctx.fillRect(-2, -48, 4, 4); for (let i = 0; i < 8; i++) { ctx.fillStyle = Math.sin(t * 3 + i) > 0 ? ['#ef4444', '#3b82f6', '#fbbf24', '#f472b6'][i % 4] : '#333'; ctx.fillRect(-10 + ((i * 7) % 20), -8 - ((i * 11) % 34), 2, 2); } }, 0.3, 1.5)] });
add({ id: 'ev-lupa', name: 'Lupa de comparar preços', cat: 'colecionaveis', price: 25, rarity: 'raro', w: 1, d: 1, place: 'top', event: 'ev-consumidor', model: () => [spr(0.5, 0.5, 0, (ctx) => { ctx.strokeStyle = '#c0c6d0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -8, 5, 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(160,210,255,0.5)'; ctx.fill(); ctx.fillStyle = '#6b4226'; ctx.fillRect(3, -4, 6, 2); }, 0.15, 0.3)] });

/* ===================== FIXOS DE IMÓVEIS (não vendáveis) ===================== */

add({ id: 'fixo-elevador', name: 'Elevador', cat: 'fixos', fixture: true, price: 0, rarity: 'comum', w: 2, d: 1, place: 'wall', wallH: 2.2, wallZ: 0, wallPaint: (ctx, w, h) => { rect(ctx, 0, 0, w, h, '#9aa0aa'); rect(ctx, 3, 6, w / 2 - 4, h - 6, '#c9ced6'); rect(ctx, w / 2 + 1, 6, w / 2 - 4, h - 6, '#c9ced6'); rect(ctx, w / 2 - 6, 1, 12, 4, '#111'); rect(ctx, w / 2 - 2, 2, 4, 2, '#f87171'); } });
add({ id: 'fixo-janelao', name: 'Janelão com vista da cidade', cat: 'fixos', fixture: true, price: 0, rarity: 'comum', w: 4, d: 1, place: 'wall', wallH: 2.2, wallZ: 0.2, wallPaint: windowPaint('#1f2937', [4, 1]), light: { color: '#d7e8ff', r: 4.5, z: 1.5 } });
add({ id: 'fixo-coluna', name: 'Coluna estrutural', cat: 'fixos', fixture: true, price: 0, rarity: 'comum', w: 1, d: 1, place: 'floor', model: () => [box(0.2, 0.2, 0, 0.6, 0.6, 3.2, '#d8d4cb')] });

export const ITEM_LIST: ItemDef[] = ITEMS;
export const ITEMS_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
/** Itens de preço zero são a "sucata" que vem com o quarto: não são vendidos na loja. */
export const SHOP_ITEMS = ITEMS.filter((i) => !i.fixture && i.price > 0);

export function getItem(id: string): ItemDef | undefined {
  return ITEMS_BY_ID[id];
}

/** Valor de revenda (em moedas virtuais). */
export function sellPrice(def: ItemDef) {
  return Math.floor(def.price * 0.5);
}

export interface CollectionDef { id: string; name: string; desc: string; bonusCoins: number }
export const COLLECTIONS: CollectionDef[] = [
  { id: 'rgb', name: 'Coleção RGB', desc: 'Tudo que brilha em todas as cores.', bonusCoins: 120 },
  { id: 'gamer', name: 'Setup Gamer', desc: 'O quarto gamer completo.', bonusCoins: 250 },
  { id: 'kawaii', name: 'Cantinho Kawaii', desc: 'Fofura máxima.', bonusCoins: 150 },
  { id: 'retro', name: 'Fliperama Retrô', desc: 'Nostalgia dos anos 80 e 90.', bonusCoins: 300 },
  { id: 'ceo', name: 'Sala do CEO', desc: 'Mobília de quem decide.', bonusCoins: 600 },
  { id: 'trofeus', name: 'Galeria de Troféus', desc: 'Bronze, prata, ouro e diamante.', bonusCoins: 400 },
  { id: 'futuro', name: 'Escritório do Futuro', desc: 'Tecnologia de ponta.', bonusCoins: 800 },
  { id: 'imperio', name: 'Império Dourado', desc: 'O luxo supremo.', bonusCoins: 2000 },
];
export function collectionItems(cid: string) {
  return SHOP_ITEMS.filter((i) => i.collection === cid);
}

export { withAlpha };

/* ===================== extensões (Escritório dos robôs) ===================== */

/** Registra um item extra em tempo de execução (não entra na loja do jogo). */
export function registerItem(d: ItemDef, overwrite = false) {
  if (ITEMS_BY_ID[d.id] && !overwrite) return ITEMS_BY_ID[d.id];
  ITEMS_BY_ID[d.id] = d;
  return d;
}
export const models = { chairModel, deskModel, rug, rugPaint, box, spr, rect };
