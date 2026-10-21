import { rotFootprint } from '../engine/prims';
import type { OwnedItem, Placement, SaveData } from '../state/types';
import { getItem, type ItemDef } from './catalog';
import { getProperty, roomSize } from './properties';

export interface PlacedItem { item: OwnedItem; def: ItemDef; p: Placement; w: number; d: number; z: number }

export interface RoomInfo {
  propertyId: string;
  W: number;
  D: number;
  wallH: number;
  placed: PlacedItem[];
}

export function roomInfo(save: SaveData, propertyId = save.game.currentProperty): RoomInfo {
  const prop = getProperty(propertyId);
  const room = save.game.rooms[propertyId];
  const { w: W, d: D } = roomSize(prop, room?.expansion ?? 0);
  const placed: PlacedItem[] = [];
  for (const item of save.game.inventory) {
    if (!item.placed || item.placed.propertyId !== propertyId) continue;
    const def = getItem(item.defId);
    if (!def) continue;
    const fp = def.place === 'wall' ? { w: def.w, d: 1 } : rotFootprint(def.w, def.d, item.placed.rot);
    placed.push({ item, def, p: item.placed, w: fp.w, d: fp.d, z: 0 });
  }
  // altura de itens sobre superfícies
  const surf = surfaceMap(placed, W, D);
  for (const pi of placed) {
    if (pi.def.place === 'top') pi.z = surf.get(`${pi.p.x},${pi.p.y}`) ?? 0;
  }
  return { propertyId, W, D, wallH: prop.wallH, placed };
}

function surfaceMap(placed: PlacedItem[], W: number, D: number) {
  const m = new Map<string, number>();
  for (const pi of placed) {
    if (pi.def.place !== 'floor' || !pi.def.surface) continue;
    for (let x = pi.p.x; x < pi.p.x + pi.w; x++) for (let y = pi.p.y; y < pi.p.y + pi.d; y++) if (x < W && y < D) m.set(`${x},${y}`, pi.def.surface);
  }
  return m;
}

export interface PlaceCheck { ok: boolean; reason?: string; z: number }

export function checkPlacement(room: RoomInfo, def: ItemDef, p: Placement, ignoreUid?: number): PlaceCheck {
  const others = room.placed.filter((o) => o.item.uid !== ignoreUid);
  if (def.place === 'wall') {
    const along = p.rot === 1 ? room.W : room.D;
    const pos = p.rot === 1 ? p.x : p.y;
    if (pos < 0 || pos + def.w > along) return { ok: false, reason: 'Fora da parede', z: 0 };
    if ((def.wallZ ?? 0) + (def.wallH ?? 1) > room.wallH + 0.01) return { ok: false, reason: 'Alto demais para esta parede', z: 0 };
    for (const o of others) {
      if (o.def.place !== 'wall' || o.p.rot !== p.rot) continue;
      const opos = o.p.rot === 1 ? o.p.x : o.p.y;
      const overlapH = pos < opos + o.def.w && opos < pos + def.w;
      const z0 = def.wallZ ?? 0, z1 = z0 + (def.wallH ?? 1), oz0 = o.def.wallZ ?? 0, oz1 = oz0 + (o.def.wallH ?? 1);
      if (overlapH && z0 < oz1 && oz0 < z1) return { ok: false, reason: 'Já tem algo nessa parede', z: 0 };
    }
    return { ok: true, z: def.wallZ ?? 0 };
  }
  const fp = rotFootprint(def.w, def.d, p.rot);
  if (p.x < 0 || p.y < 0 || p.x + fp.w > room.W || p.y + fp.d > room.D) return { ok: false, reason: 'Fora do ambiente', z: 0 };
  if (def.place === 'rug') return { ok: true, z: 0 };
  const tiles: [number, number][] = [];
  for (let x = p.x; x < p.x + fp.w; x++) for (let y = p.y; y < p.y + fp.d; y++) tiles.push([x, y]);
  const floorAt = (x: number, y: number) => others.find((o) => o.def.place === 'floor' && x >= o.p.x && x < o.p.x + o.w && y >= o.p.y && y < o.p.y + o.d);
  if (def.place === 'floor') {
    for (const [x, y] of tiles) {
      const f = floorAt(x, y);
      if (f) return { ok: false, reason: `Ocupado por ${f.def.name}`, z: 0 };
    }
    return { ok: true, z: 0 };
  }
  // top: sobre superfície (todos os tiles com a mesma altura) ou no chão livre
  const topOnFloorAt = (x: number, y: number) => others.find((o) => o.def.place === 'top' && o.z === 0 && x >= o.p.x && x < o.p.x + o.w && y >= o.p.y && y < o.p.y + o.d);
  let z: number | null = null;
  for (const [x, y] of tiles) {
    const f = floorAt(x, y);
    const h = f ? f.def.surface ?? -1 : 0;
    if (h < 0) return { ok: false, reason: `Não dá para colocar em cima de ${f!.def.name}`, z: 0 };
    if (z === null) z = h;
    else if (z !== h) return { ok: false, reason: 'Superfície irregular', z: 0 };
    if (h === 0) { const o = topOnFloorAt(x, y); if (o) return { ok: false, reason: `Ocupado por ${o.def.name}`, z: 0 }; }
  }
  return { ok: true, z: z ?? 0 };
}

/** Grade de bloqueio para caminhada: true = bloqueado */
export function walkGrid(room: RoomInfo): boolean[][] {
  const g: boolean[][] = Array.from({ length: room.W }, () => Array(room.D).fill(false));
  for (const o of room.placed) {
    if (o.def.place !== 'floor') continue;
    for (let x = o.p.x; x < o.p.x + o.w; x++) for (let y = o.p.y; y < o.p.y + o.d; y++) if (x < room.W && y < room.D) g[x][y] = true;
  }
  return g;
}

/** Primeira posição livre para um item (usado em "colocar automaticamente") */
export function findFreeSpot(room: RoomInfo, def: ItemDef): Placement | null {
  if (def.place === 'wall') {
    for (const rot of [1, 0]) for (let pos = 0; pos < (rot === 1 ? room.W : room.D); pos++) {
      const p = { propertyId: room.propertyId, x: rot === 1 ? pos : 0, y: rot === 1 ? 0 : pos, rot };
      if (checkPlacement(room, def, p).ok) return p;
    }
    return null;
  }
  // prioridade: sobre superfícies (itens de mesa), depois chão perto do centro
  const cands: Placement[] = [];
  for (let x = 0; x < room.W; x++) for (let y = 0; y < room.D; y++) for (const rot of [0, 1]) cands.push({ propertyId: room.propertyId, x, y, rot });
  const cx = room.W / 2, cy = room.D / 2;
  cands.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
  if (def.place === 'top') {
    for (const p of cands) { const c = checkPlacement(room, def, p); if (c.ok && c.z > 0) return p; }
  }
  for (const p of cands) if (checkPlacement(room, def, p).ok) return p;
  return null;
}
