import type { AvatarConfig, Placement, SaveData } from '../state/types';
import { getItem, type ItemDef } from '../game/catalog';
import { getProperty } from '../game/properties';
import { checkPlacement, roomInfo, walkGrid, type RoomInfo } from '../game/room';
import { getStyle, LIGHT_THEMES } from '../game/styles';
import { drawAvatar, type AvatarAnim } from './avatar';
import { isoX, isoY, screenToTile, shade, TH, TW, ZS, hsl } from './iso';
import { findPath, nearestFree } from './pathfind';
import {
  depthSort, drawBox, FS, isBehind, rotateBox, rotatePoint, rotFootprint, screenBounds,
  type Prim, type RotBox, type Sortable, type SpritePrim,
} from './prims';

/* ======================== tipos ======================== */

interface DrawBox extends Sortable { kind: 'box'; b: RotBox; ox: number; oy: number; uid: number; alpha?: number }
interface DrawSpr extends Sortable { kind: 'spr'; s: SpritePrim; sx: number; sy: number; rot: number; uid: number; alpha?: number }
interface DrawActor extends Sortable { kind: 'actor'; a: Actor }
type Drawable = DrawBox | DrawSpr | DrawActor;

export interface Actor {
  id: string;
  avatar: AvatarConfig;
  x: number; y: number; z: number;
  dir: number;
  anim: AvatarAnim;
  path: [number, number][];
  speed: number;
  onArrive?: () => void;
  speech?: { text: string; until: number };
  isPlayer: boolean;
  seatUid?: number;
  idleUntil?: number;
  name?: string;
  lie?: number;
}

interface Particle { x: number; y: number; vx: number; vy: number; c: string; life: number; max: number; r: number; kind: 'confetti' | 'coin' | 'spark' }
interface FloatText { x: number; y: number; text: string; color: string; life: number }

export type EngineMode = 'play' | 'edit' | 'place';
export interface PlaceState { uid?: number; defId: string; rot: number }

export interface EngineCallbacks {
  onItemClick?: (uid: number, def: ItemDef) => void;
  onSelect?: (uid: number | null) => void;
  onPlace?: (p: Placement, place: PlaceState) => void;
  onPlaceInvalid?: (reason: string) => void;
  onUse?: (def: ItemDef, uid: number) => void;
  onHint?: (text: string) => void;
}

const SAYINGS: Record<string, string[]> = {
  computer: ['Revisando as finanças...', 'Planilha aberta!', 'Bora registrar tudo.', 'Ctrl+S na vida.'],
  tv: ['Só mais um episódio...', 'Documentário sobre juros compostos!', 'Propaganda de cartão... não!'],
  coffee: ['Café: o melhor investimento.', 'Mais um cafezinho.', 'Feito em casa = economia!'],
  fridge: ['Água gelada. Grátis!', 'Marmita de ontem. Economia!', 'Nada de delivery hoje.'],
  plant: ['Regando...', 'Cresça como meu patrimônio!', 'Plantinha feliz.'],
  music: ['♪ ♫ ♪', 'Lo-fi para economizar.', '♫ Dinheiro no bolso ♫'],
  game: ['Só uma partida!', 'GG!', 'Jogo que já paguei. Zero gasto.'],
  fan: ['Ahhh, ventinho.', 'Melhor que ar-condicionado na conta de luz.'],
  money: ['Cofrinho alimentado!', 'Tlim!', 'Cada moeda conta.'],
  water: ['Hidratação em dia.'],
  print: ['Imprimindo relatório financeiro...'],
};

/* ======================== motor ======================== */

export class GameEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  world: HTMLCanvasElement;
  wctx: CanvasRenderingContext2D;
  light: HTMLCanvasElement;
  lctx: CanvasRenderingContext2D;
  save: SaveData | null = null;
  room: RoomInfo | null = null;
  grid: boolean[][] = [];
  staticList: Drawable[] = [];
  flatList: Drawable[] = [];
  staticKey = '';
  O = { x: 0, y: 0 }; // origem do tile (0,0,0) no canvas do mundo
  cam = { x: 0, y: 0, zoom: 2 };
  camTarget: { x: number; y: number; zoom: number } | null = null;
  mode: EngineMode = 'play';
  place: PlaceState | null = null;
  hoverPlace: { p: Placement; ok: boolean; reason?: string } | null = null;
  selected: number | null = null;
  hoverUid: number | null = null;
  player: Actor;
  npcs: Actor[] = [];
  particles: Particle[] = [];
  floats: FloatText[] = [];
  cb: EngineCallbacks = {};
  raf = 0;
  last = 0;
  t = 0;
  dpr = 1;
  pointers = new Map<number, { x: number; y: number }>();
  drag: { sx: number; sy: number; cx: number; cy: number; moved: boolean; pinch?: { d: number; zoom: number } } | null = null;
  reduceMotion = false;
  showGrid = false;
  destroyed = false;
  /** espaço ocupado por painéis à direita/embaixo (px de canvas) */
  inset = { right: 0, bottom: 0 };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.world = document.createElement('canvas');
    this.wctx = this.world.getContext('2d')!;
    this.light = document.createElement('canvas');
    this.lctx = this.light.getContext('2d')!;
    this.player = { id: 'player', avatar: {} as AvatarConfig, x: 1.5, y: 1.5, z: 0, dir: 0, anim: 'idle', path: [], speed: 2.4, isPlayer: true };
    this.bindInput();
    this.resize();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.unbind?.();
  }

  /* ---------------- dados ---------------- */

  setSave(save: SaveData) {
    const propChanged = this.save?.game.currentProperty !== save.game.currentProperty;
    this.save = save;
    this.player.avatar = save.profile.avatar;
    this.player.name = save.profile.name;
    this.reduceMotion = save.settings.reduceMotion;
    this.showGrid = save.settings.showGrid;
    this.rebuild();
    if (propChanged) {
      this.spawnPlayer();
      this.spawnNpcs();
      this.fit(true);
    } else {
      // se o tile do jogador ficou bloqueado, reposiciona
      const px = Math.floor(this.player.x), py = Math.floor(this.player.y);
      if (!this.player.seatUid && (!this.grid[px] || this.grid[px][py] === undefined || this.grid[px][py])) this.spawnPlayer();
      if (this.player.seatUid && !this.room!.placed.some((p) => p.item.uid === this.player.seatUid)) { this.player.seatUid = undefined; this.player.anim = 'idle'; this.spawnPlayer(); }
    }
  }

  private spawnPlayer() {
    const r = this.room!;
    const f = nearestFree(this.grid, r.W / 2, r.D / 2) ?? [0, 0];
    Object.assign(this.player, { x: f[0] + 0.5, y: f[1] + 0.5, z: 0, path: [], anim: 'idle', seatUid: undefined });
  }

  private spawnNpcs() {
    const p = getProperty(this.save!.game.currentProperty);
    this.npcs = [];
    const names = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabi', 'Heitor', 'Iara', 'João', 'Kátia', 'Léo', 'Marina', 'Nina', 'Otávio', 'Paula'];
    for (let i = 0; i < p.npcs; i++) {
      const f = nearestFree(this.grid, Math.random() * this.room!.W, Math.random() * this.room!.D);
      if (!f) break;
      this.npcs.push({
        id: `npc${i}`, name: names[i % names.length], isPlayer: false, x: f[0] + 0.5, y: f[1] + 0.5, z: 0, dir: i % 4, anim: 'idle', path: [], speed: 1.6,
        avatar: { skin: (i * 3) % 6, hairStyle: (i * 7) % 10, hairColor: (i * 5) % 10, eyes: i % 4, mouth: (i + 1) % 4, shirtStyle: [2, 4, 0, 5, 2, 4][i % 6], shirtColor: (i * 4 + 1) % 13, pantsStyle: i % 3 === 2 ? 2 : 0, pantsColor: [1, 12, 10, 11][i % 4], shoesColor: 1, accessory: i % 5 === 0 ? 1 : 0, beard: i % 4 === 1 ? 2 : 0 },
        idleUntil: performance.now() + 1000 + Math.random() * 4000,
      });
    }
  }

  rebuild() {
    if (!this.save) return;
    const save = this.save;
    const room = roomInfo(save);
    this.room = room;
    this.grid = walkGrid(room);
    const rs = save.game.rooms[save.game.currentProperty];
    const key = JSON.stringify([save.game.currentProperty, rs, room.W, room.D, room.placed.map((p) => [p.item.uid, p.def.id, p.p.x, p.p.y, p.p.rot, p.z]), this.place?.uid]);
    if (key === this.staticKey) return;
    this.staticKey = key;
    // tamanho do canvas do mundo
    const M = 48;
    const wallPx = room.wallH * ZS;
    const w = (room.W + room.D) * (TW / 2) + M * 2;
    const h = (room.W + room.D) * (TH / 2) + wallPx + M * 2 + 24;
    if (this.world.width !== Math.ceil(w) || this.world.height !== Math.ceil(h)) {
      this.world.width = Math.ceil(w); this.world.height = Math.ceil(h);
      this.light.width = this.world.width; this.light.height = this.world.height;
    }
    this.O = { x: room.D * (TW / 2) + M, y: wallPx + M + 24 };
    const list: Drawable[] = [];
    const flat: Drawable[] = [];
    for (const pi of room.placed) {
      if (pi.def.place === 'wall') continue;
      if (this.place?.uid === pi.item.uid) continue; // escondido enquanto é movido
      const ds = this.itemDrawables(pi.def, pi.p.x, pi.p.y, pi.z, pi.p.rot, pi.item.uid);
      const isFlat = pi.def.place === 'rug' && ds.every((d) => d.z1 - d.z0 <= 0.06 && d.z0 <= 0.01);
      (isFlat ? flat : list).push(...ds);
    }
    this.staticList = depthSort(list);
    this.flatList = flat;
  }

  itemDrawables(def: ItemDef, px: number, py: number, pz: number, rot: number, uid: number, alpha?: number): Drawable[] {
    const prims: Prim[] = def.model ? def.model() : [];
    const out: Drawable[] = [];
    const W = def.w, D = def.d;
    for (const pr of prims) {
      if (pr.t === 'box') {
        const rb = rotateBox(pr, W, D, rot);
        const s = { x0: px + rb.x, y0: py + rb.y, z0: pz + rb.z, x1: px + rb.x + rb.w, y1: py + rb.y + rb.d, z1: pz + rb.z + rb.h };
        out.push({ kind: 'box', b: rb, ox: this.O.x + isoX(px, py), oy: this.O.y + isoY(px, py, pz), uid, alpha, ...s, ...screenBounds(s) });
      } else {
        const rp = rotatePoint(pr.x, pr.y, W, D, rot);
        const r = pr.r ?? 0.2, h = pr.h ?? 0.5;
        const wx = px + rp.x, wy = py + rp.y, wz = pz + pr.z;
        const s = { x0: wx - r, y0: wy - r, z0: wz, x1: wx + r, y1: wy + r, z1: wz + h };
        const sb = screenBounds(s);
        out.push({ kind: 'spr', s: pr, sx: this.O.x + isoX(wx, wy), sy: this.O.y + isoY(wx, wy, wz), rot, uid, alpha, ...s, ...sb, sy0: sb.sy0 - 30, sx0: sb.sx0 - 20, sx1: sb.sx1 + 20 });
      }
    }
    return out;
  }

  /* ---------------- câmera ---------------- */

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * this.dpr)), h = Math.max(1, Math.round(r.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
  }

  fit(instant = false) {
    if (!this.room) return;
    const cw = this.canvas.width - this.inset.right, ch = this.canvas.height - this.inset.bottom;
    const zoom = Math.max(0.5, Math.min(4 * this.dpr, Math.min(cw / this.world.width, ch / this.world.height) * 0.92));
    const target = { x: this.world.width / 2 + this.inset.right / 2 / zoom, y: this.world.height / 2 + 10 + this.inset.bottom / 2 / zoom, zoom };
    if (instant) { this.cam = { ...target }; this.camTarget = null; } else this.camTarget = target;
  }

  setInset(right: number, bottom: number) {
    const r = Math.round(right * this.dpr), b = Math.round(bottom * this.dpr);
    if (r === this.inset.right && b === this.inset.bottom) return;
    this.inset = { right: r, bottom: b };
    this.fit();
  }

  zoomBy(f: number, sx = this.canvas.width / 2, sy = this.canvas.height / 2) {
    const before = this.screenToWorld(sx, sy);
    this.cam.zoom = Math.max(0.4 * this.dpr, Math.min(6 * this.dpr, this.cam.zoom * f));
    const after = this.screenToWorld(sx, sy);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
    this.camTarget = null;
  }

  screenToWorld(sx: number, sy: number) {
    return { x: (sx - this.canvas.width / 2) / this.cam.zoom + this.cam.x, y: (sy - this.canvas.height / 2) / this.cam.zoom + this.cam.y };
  }
  worldToScreen(wx: number, wy: number) {
    return { x: (wx - this.cam.x) * this.cam.zoom + this.canvas.width / 2, y: (wy - this.cam.y) * this.cam.zoom + this.canvas.height / 2 };
  }

  /* ---------------- modos ---------------- */

  setMode(m: EngineMode, place?: PlaceState) {
    this.mode = m;
    this.place = m === 'place' ? place ?? null : null;
    this.hoverPlace = null;
    if (m !== 'edit') this.selected = null;
    this.staticKey = '';
    this.rebuild();
  }
  rotatePlace() {
    if (this.place) {
      const def = getItem(this.place.defId);
      this.place.rot = def?.place === 'wall' ? (this.place.rot + 1) % 2 : (this.place.rot + 1) % 4;
      if (this.hoverPlace) this.updateHoverPlace(this.hoverPlace.p.x, this.hoverPlace.p.y, def?.place === 'wall');
    }
  }

  /* ---------------- ações do personagem ---------------- */

  say(a: Actor, text: string, secs = 3) { a.speech = { text, until: performance.now() + secs * 1000 }; }

  celebrate(text?: string) {
    const a = this.player;
    if (a.seatUid) { a.seatUid = undefined; const f = nearestFree(this.grid, a.x, a.y); if (f) { a.x = f[0] + 0.5; a.y = f[1] + 0.5; a.z = 0; } }
    a.path = [];
    a.anim = 'celebrate';
    a.idleUntil = performance.now() + 2600;
    if (text) this.say(a, text, 3.5);
    if (this.reduceMotion) return;
    const sx = this.O.x + isoX(a.x, a.y), sy = this.O.y + isoY(a.x, a.y, 1.6);
    const cols = ['#ff5d7f', '#ffd34d', '#4ade80', '#60a5fa', '#c084fc', '#ffffff'];
    for (let i = 0; i < 90; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = 60 + Math.random() * 140;
      this.particles.push({ x: sx, y: sy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, c: cols[i % cols.length], life: 0, max: 1.6 + Math.random() * 1.2, r: 1 + Math.random() * 2, kind: 'confetti' });
    }
  }

  coinBurst(amount: number) {
    const a = this.player;
    const sx = this.O.x + isoX(a.x, a.y), sy = this.O.y + isoY(a.x, a.y, 1.9);
    this.floats.push({ x: sx, y: sy, text: `+${amount} 🪙`.replace(' 🪙', ' moedas'), color: '#ffd34d', life: 0 });
    if (this.reduceMotion) return;
    for (let i = 0; i < Math.min(30, 6 + amount / 5); i++) {
      this.particles.push({ x: sx, y: sy, vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 80, c: '#ffd34d', life: 0, max: 1.2, r: 2, kind: 'coin' });
    }
  }

  walkTo(tx: number, ty: number, onArrive?: () => void, allowBlocked = false): boolean {
    const a = this.player;
    this.standUp(a);
    const sx = Math.floor(a.x), sy = Math.floor(a.y);
    const path = findPath(this.grid, sx, sy, tx, ty, allowBlocked);
    if (!path) return false;
    a.path = path.slice(1);
    a.onArrive = onArrive;
    a.anim = a.path.length ? 'walk' : 'idle';
    if (!a.path.length) onArrive?.();
    return true;
  }

  private standUp(a: Actor) {
    if (a.seatUid !== undefined || a.anim === 'sleep' || a.anim === 'sit' || a.anim === 'type') {
      a.seatUid = undefined;
      a.z = 0;
      a.anim = 'idle';
      const tx = Math.floor(a.x), ty = Math.floor(a.y);
      if (this.grid[tx]?.[ty]) {
        const f = nearestFree(this.grid, a.x, a.y);
        if (f) { a.x = f[0] + 0.5; a.y = f[1] + 0.5; }
      }
    }
  }

  /** caminha até um tile adjacente ao retângulo e executa cb */
  private approach(x: number, y: number, w: number, d: number, cb: (ax: number, ay: number) => void, includeInside = false): boolean {
    const a = this.player;
    const cands: [number, number][] = [];
    for (let i = x - 1; i <= x + w; i++) for (let j = y - 1; j <= y + d; j++) {
      const inside = i >= x && i < x + w && j >= y && j < y + d;
      if (inside && !includeInside) continue;
      if (!this.grid[i] || this.grid[i][j] === undefined) continue;
      if (this.grid[i][j] && !inside) continue;
      cands.push([i, j]);
    }
    cands.sort((p, q) => Math.hypot(p[0] + 0.5 - a.x, p[1] + 0.5 - a.y) - Math.hypot(q[0] + 0.5 - a.x, q[1] + 0.5 - a.y));
    this.standUp(a);
    for (const [i, j] of cands) {
      const path = findPath(this.grid, Math.floor(a.x), Math.floor(a.y), i, j);
      if (path) {
        a.path = path.slice(1);
        a.anim = a.path.length ? 'walk' : 'idle';
        a.onArrive = () => cb(i, j);
        if (!a.path.length) cb(i, j);
        return true;
      }
    }
    return false;
  }

  private faceTowards(a: Actor, tx: number, ty: number) {
    const dx = tx - a.x, dy = ty - a.y;
    if (Math.abs(dx) > Math.abs(dy)) a.dir = dx > 0 ? 1 : 3; else a.dir = dy > 0 ? 0 : 2;
  }

  private sitOn(a: Actor, uid: number, anim: AvatarAnim = 'sit') {
    const pi = this.room!.placed.find((p) => p.item.uid === uid);
    if (!pi) return;
    const def = pi.def;
    // tile do assento mais próximo
    let best: [number, number] = [pi.p.x, pi.p.y], bd = Infinity;
    for (let i = pi.p.x; i < pi.p.x + pi.w; i++) for (let j = pi.p.y; j < pi.p.y + pi.d; j++) {
      const dd = Math.hypot(i + 0.5 - a.x, j + 0.5 - a.y);
      if (dd < bd) { bd = dd; best = [i, j]; }
    }
    const occupied = [this.player, ...this.npcs].some((o) => o !== a && o.seatUid === uid && Math.floor(o.x) === best[0] && Math.floor(o.y) === best[1]);
    if (occupied) { this.say(a, 'Ocupado!'); return; }
    a.seatUid = uid;
    a.x = best[0] + 0.5; a.y = best[1] + 0.5;
    if (def.sleep != null) {
      // deita no centro da cama, cabeça do lado do travesseiro
      const fp = rotFootprint(def.w, def.d, pi.p.rot);
      const ang = Math.atan2(1, 2); // inclinação isométrica (~26,6°)
      const A = Math.PI / 2 - ang; // 63,4°
      const lies = [-A, A, Math.PI - A, Math.PI + A];
      a.x = pi.p.x + fp.w / 2; a.y = pi.p.y + fp.d / 2;
      a.z = def.sleep;
      a.anim = 'sleep';
      a.lie = lies[pi.p.rot & 3];
      a.dir = 0;
      return;
    }
    a.z = def.sit ?? 0.45;
    a.anim = anim;
    a.dir = [0, 3, 2, 1][pi.p.rot & 3];
  }

  /** Clique num item no modo jogo */
  interact(uid: number) {
    const pi = this.room?.placed.find((p) => p.item.uid === uid);
    if (!pi) return;
    const def = pi.def;
    const a = this.player;
    if (def.sit != null || def.sleep != null) {
      this.approach(pi.p.x, pi.p.y, pi.w, pi.d, () => {
        this.sitOn(a, uid);
        if (def.sleep != null) this.say(a, def.sad ? 'Esse colchão tem memória... e não é boa.' : 'Zzz... sonhando com juros compostos.', 3);
      });
      return;
    }
    const use = def.use;
    if (use === 'computer' || use === 'tv' || use === 'game') {
      // procura um assento perto
      const seats = this.room!.placed.filter((p) => p.def.sit != null && Math.hypot(p.p.x + p.w / 2 - (pi.p.x + pi.w / 2), p.p.y + p.d / 2 - (pi.p.y + pi.d / 2)) <= (use === 'computer' ? 2.2 : 4.5));
      seats.sort((p, q) => Math.hypot(p.p.x - pi.p.x, p.p.y - pi.p.y) - Math.hypot(q.p.x - pi.p.x, q.p.y - pi.p.y));
      const seat = seats[0];
      const done = () => {
        this.faceTowards(a, pi.p.x + pi.w / 2, pi.p.y + pi.d / 2);
        this.say(a, this.pickSaying(use, def));
        this.cb.onUse?.(def, uid);
      };
      if (seat) {
        this.approach(seat.p.x, seat.p.y, seat.w, seat.d, () => {
          this.sitOn(a, seat.item.uid, use === 'computer' ? 'type' : 'sit');
          // vira para o item se a cadeira estiver de lado
          if (use === 'computer') this.faceTowards(a, pi.p.x + 0.5, pi.p.y + 0.5);
          done();
        });
      } else {
        this.approach(pi.p.x, pi.p.y, pi.w, pi.d, () => { a.anim = 'use'; a.idleUntil = performance.now() + 3000; done(); });
      }
      return;
    }
    this.approach(pi.p.x, pi.p.y, pi.w, pi.d, () => {
      this.faceTowards(a, pi.p.x + pi.w / 2, pi.p.y + pi.d / 2);
      a.anim = use === 'coffee' || use === 'water' ? 'drink' : 'use';
      a.idleUntil = performance.now() + 2500;
      this.say(a, use ? this.pickSaying(use, def) : def.sad ? 'Um dia eu troco isso.' : `Que ${def.name.toLowerCase()} bonito(a)!`);
      this.cb.onUse?.(def, uid);
    });
  }

  private pickSaying(use: string, def: ItemDef) {
    if (def.sad && use === 'computer') return 'Esse PC faz barulho de avião...';
    const arr = SAYINGS[use] ?? ['Hm.'];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /* ---------------- atualização ---------------- */

  private updateActor(a: Actor, dt: number, now: number) {
    if (a.path.length) {
      const [tx, ty] = a.path[0];
      const gx = tx + 0.5, gy = ty + 0.5;
      const dx = gx - a.x, dy = gy - a.y;
      const dist = Math.hypot(dx, dy);
      const step = a.speed * dt;
      this.faceTowards(a, gx, gy);
      a.anim = 'walk';
      if (dist <= step) {
        a.x = gx; a.y = gy;
        a.path.shift();
        if (!a.path.length) {
          a.anim = 'idle';
          const cb = a.onArrive; a.onArrive = undefined; cb?.();
        }
      } else {
        a.x += (dx / dist) * step; a.y += (dy / dist) * step;
      }
    } else if ((a.anim === 'celebrate' || a.anim === 'use' || a.anim === 'drink') && a.idleUntil && now > a.idleUntil) {
      a.anim = 'idle';
    }
    if (!a.isPlayer && !a.path.length && (!a.idleUntil || now > a.idleUntil)) this.npcThink(a, now);
  }

  private npcThink(a: Actor, now: number) {
    a.idleUntil = now + 3000 + Math.random() * 7000;
    const r = Math.random();
    if (a.seatUid !== undefined && r < 0.6) return; // continua trabalhando
    if (a.seatUid !== undefined) { a.seatUid = undefined; a.z = 0; a.anim = 'idle'; const f = nearestFree(this.grid, a.x, a.y); if (f) { a.x = f[0] + 0.5; a.y = f[1] + 0.5; } }
    const seats = this.room!.placed.filter((p) => p.def.sit != null && ![this.player, ...this.npcs].some((o) => o.seatUid === p.item.uid));
    if (seats.length && r < 0.55) {
      const s = seats[Math.floor(Math.random() * seats.length)];
      for (let i = s.p.x - 1; i <= s.p.x + s.w; i++) for (let j = s.p.y - 1; j <= s.p.y + s.d; j++) {
        if (this.grid[i]?.[j] === false) {
          const path = findPath(this.grid, Math.floor(a.x), Math.floor(a.y), i, j);
          if (path) { a.path = path.slice(1); a.onArrive = () => this.sitOn(a, s.item.uid, Math.random() < 0.7 ? 'type' : 'sit'); return; }
        }
      }
    }
    const f = nearestFree(this.grid, Math.random() * this.room!.W, Math.random() * this.room!.D);
    if (f) {
      const path = findPath(this.grid, Math.floor(a.x), Math.floor(a.y), f[0], f[1]);
      if (path) a.path = path.slice(1);
    }
    if (Math.random() < 0.15) this.say(a, ['Reunião às 15h!', 'Relatório pronto.', 'Bom dia, chefe!', 'Cafézinho?', 'Batemos a meta!'][Math.floor(Math.random() * 5)], 2.5);
  }

  frame = (ts: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (ts - (this.last || ts)) / 1000);
    this.last = ts;
    this.t += dt;
    this.resize();
    if (this.camTarget) {
      const k = Math.min(1, dt * 8);
      this.cam.x += (this.camTarget.x - this.cam.x) * k;
      this.cam.y += (this.camTarget.y - this.cam.y) * k;
      this.cam.zoom += (this.camTarget.zoom - this.cam.zoom) * k;
      if (Math.abs(this.camTarget.zoom - this.cam.zoom) < 0.001 && Math.abs(this.camTarget.x - this.cam.x) < 0.5) this.camTarget = null;
    }
    if (!this.room || !this.save) return;
    const now = performance.now();
    this.updateActor(this.player, dt, now);
    for (const n of this.npcs) this.updateActor(n, dt, now);
    for (const p of this.particles) {
      p.life += dt;
      p.vy += (p.kind === 'confetti' ? 120 : 220) * dt;
      p.vx *= 0.985;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const f of this.floats) { f.life += dt; f.y -= 22 * dt; }
    this.floats = this.floats.filter((f) => f.life < 2);
    this.render();
  };

  /* ---------------- render ---------------- */

  render() {
    const room = this.room!, save = this.save!;
    const ctx = this.wctx;
    const t = this.reduceMotion ? 0 : this.t;
    const rs = save.game.rooms[save.game.currentProperty];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.world.width, this.world.height);
    ctx.imageSmoothingEnabled = false;

    this.drawWalls(ctx, room, rs.wall, t);
    // itens de parede
    for (const pi of room.placed) if (pi.def.place === 'wall' && this.place?.uid !== pi.item.uid) this.drawWallItem(ctx, pi.def, pi.p, t, pi.item.uid === this.selected || pi.item.uid === this.hoverUid ? 1 : 0);
    this.drawFloor(ctx, room, rs.floor, t);
    for (const d of this.flatList) this.drawDrawable(ctx, d, t);
    // sombras
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (const pi of room.placed) {
      if (pi.def.place !== 'floor' || this.place?.uid === pi.item.uid) continue;
      const pts = [[pi.p.x + 0.08, pi.p.y + 0.15], [pi.p.x + pi.w + 0.12, pi.p.y + 0.15], [pi.p.x + pi.w + 0.12, pi.p.y + pi.d + 0.1], [pi.p.x + 0.08, pi.p.y + pi.d + 0.1]];
      ctx.beginPath();
      pts.forEach(([x, y], i) => { const X = this.O.x + isoX(x, y), Y = this.O.y + isoY(x, y); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
      ctx.fill();
    }
    ctx.restore();
    if (this.mode !== 'play' || this.showGrid) this.drawGrid(ctx, room);

    // lista ordenada + atores
    const list = this.insertActors();
    for (const d of list) {
      const hl = d.kind !== 'actor' && (d.uid === this.selected || (this.mode !== 'place' && d.uid === this.hoverUid));
      this.drawDrawable(ctx, d, t, hl);
    }

    // fantasma de posicionamento
    if (this.mode === 'place' && this.place && this.hoverPlace) this.drawGhost(ctx, t);

    this.applyLighting(ctx, room, rs.light, t);

    // partículas
    for (const p of this.particles) {
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.c;
      if (p.kind === 'coin') { ctx.fillRect(p.x - 2, p.y - 2, 4, 4); ctx.fillStyle = '#fff4b0'; ctx.fillRect(p.x - 1, p.y - 2, 1, 1); }
      else ctx.fillRect(p.x, p.y, p.r * 1.5, p.r * (0.6 + Math.abs(Math.sin(p.life * 10 + p.x))));
    }
    ctx.globalAlpha = 1;

    // composição na tela
    const main = this.ctx;
    main.setTransform(1, 0, 0, 1, 0, 0);
    const cw = this.canvas.width, ch = this.canvas.height;
    const prop = getProperty(save.game.currentProperty);
    const g = main.createRadialGradient(cw / 2, ch * 0.45, 10, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
    g.addColorStop(0, shade(prop.outside, 0.12));
    g.addColorStop(1, prop.outside);
    main.fillStyle = g;
    main.fillRect(0, 0, cw, ch);
    main.imageSmoothingEnabled = false;
    const z = this.cam.zoom;
    main.drawImage(this.world, Math.round(cw / 2 - this.cam.x * z), Math.round(ch / 2 - this.cam.y * z), Math.round(this.world.width * z), Math.round(this.world.height * z));

    // balões de fala e nomes (resolução de tela)
    main.textAlign = 'center';
    main.textBaseline = 'middle';
    const fs = Math.round(11 * this.dpr);
    main.font = `bold ${fs}px "Press Start 2P", ui-monospace, monospace`;
    const now = performance.now();
    for (const a of [this.player, ...this.npcs]) {
      if (a.speech && now < a.speech.until) {
        const head = this.worldToScreen(this.O.x + isoX(a.x, a.y), this.O.y + isoY(a.x, a.y, a.z + (a.anim === 'sleep' ? 0.9 : 1.95)));
        main.font = `${Math.round(10 * this.dpr)}px "Press Start 2P", ui-monospace, monospace`;
        const tw = main.measureText(a.speech.text).width;
        const bw = tw + 16 * this.dpr, bh = 22 * this.dpr;
        const bx = head.x - bw / 2, by = head.y - bh - 10 * this.dpr;
        main.fillStyle = 'rgba(0,0,0,0.35)'; main.fillRect(bx + 2 * this.dpr, by + 2 * this.dpr, bw, bh);
        main.fillStyle = '#fffdf4'; main.fillRect(bx, by, bw, bh);
        main.strokeStyle = '#1a1420'; main.lineWidth = 2 * this.dpr; main.strokeRect(bx, by, bw, bh);
        main.fillStyle = '#fffdf4'; main.beginPath(); main.moveTo(head.x - 5 * this.dpr, by + bh - 1); main.lineTo(head.x, by + bh + 7 * this.dpr); main.lineTo(head.x + 5 * this.dpr, by + bh - 1); main.fill();
        main.fillStyle = '#1a1420'; main.fillText(a.speech.text, head.x, by + bh / 2 + 1);
      }
    }
    main.font = `bold ${fs}px "Press Start 2P", ui-monospace, monospace`;
    for (const f of this.floats) {
      const p = this.worldToScreen(f.x, f.y);
      main.globalAlpha = Math.max(0, 1 - f.life / 2);
      main.fillStyle = '#1a1420'; main.fillText(f.text, p.x + 2, p.y + 2);
      main.fillStyle = f.color; main.fillText(f.text, p.x, p.y);
    }
    main.globalAlpha = 1;
    if (this.mode === 'place' && this.hoverPlace && !this.hoverPlace.ok && this.hoverPlace.reason) {
      main.font = `${Math.round(10 * this.dpr)}px ui-monospace, monospace`;
      main.fillStyle = '#ff8080';
      main.fillText(this.hoverPlace.reason, cw / 2, ch - 24 * this.dpr);
    }
  }

  private insertActors(): Drawable[] {
    const list = [...this.staticList];
    const actors = [this.player, ...this.npcs].map((a): DrawActor => {
      const r = 0.22;
      const h = a.anim === 'sleep' ? 0.5 : a.anim === 'sit' || a.anim === 'type' ? 1.2 : 1.7;
      // dormindo: caixa alongada
      const s = a.anim === 'sleep'
        ? { x0: a.x - 0.45, y0: a.y - 0.45, z0: a.z, x1: a.x + 0.45, y1: a.y + 0.45, z1: a.z + h }
        : { x0: a.x - r, y0: a.y - r, z0: a.z, x1: a.x + r, y1: a.y + r, z1: a.z + h };
      const sb = screenBounds(s);
      return { kind: 'actor', a, ...s, ...sb, sy0: sb.sy0 - 20, sx0: sb.sx0 - 14, sx1: sb.sx1 + 14 };
    }).sort((p, q) => (p.x0 + p.y0) - (q.x0 + q.y0));
    for (const act of actors) {
      let idx = 0;
      for (let i = 0; i < list.length; i++) {
        const d = list[i];
        if (d.sx1 <= act.sx0 || act.sx1 <= d.sx0 || d.sy1 <= act.sy0 || act.sy1 <= d.sy0) continue;
        if (isBehind(d, act)) idx = i + 1;
      }
      list.splice(idx, 0, act);
    }
    return list;
  }

  private drawDrawable(ctx: CanvasRenderingContext2D, d: Drawable, t: number, highlight = false) {
    if (d.kind === 'box') {
      if (d.alpha != null) ctx.globalAlpha = d.alpha;
      drawBox(ctx, d.b, d.ox, d.oy, t);
      if (highlight) { ctx.save(); ctx.globalAlpha = 0.25 + Math.sin(this.t * 6) * 0.1; ctx.globalCompositeOperation = 'lighter'; drawBox(ctx, { ...d.b, c: '#888', ct: '#999', cl: '#888', cr: '#777', top: undefined, px: undefined, py: undefined, mx: undefined, my: undefined }, d.ox, d.oy, t); ctx.restore(); }
      ctx.globalAlpha = 1;
    } else if (d.kind === 'spr') {
      ctx.save();
      if (d.alpha != null) ctx.globalAlpha = d.alpha;
      ctx.translate(d.sx, d.sy);
      d.s.draw(ctx, t, d.rot);
      ctx.restore();
    } else {
      const a = d.a;
      ctx.save();
      ctx.translate(Math.round(this.O.x + isoX(a.x, a.y)), Math.round(this.O.y + isoY(a.x, a.y, a.z)));
      drawAvatar(ctx, a.avatar, { dir: a.dir, anim: a.anim, t: this.reduceMotion ? 0 : this.t + a.id.length, lie: a.lie });
      ctx.restore();
    }
  }

  private wallFace(ctx: CanvasRenderingContext2D, side: 'L' | 'R', pos: number, z: number) {
    // L: plano x=0, u ao longo de -y a partir de y=pos; R: plano y=0, u ao longo de +x a partir de x=pos
    if (side === 'L') {
      const ox = this.O.x + isoX(0, pos), oy = this.O.y + isoY(0, pos, z);
      ctx.transform((TW / 2) / FS, -(TH / 2) / FS, 0, ZS / FS, ox, oy);
    } else {
      const ox = this.O.x + isoX(pos, 0), oy = this.O.y + isoY(pos, 0, z);
      ctx.transform((TW / 2) / FS, (TH / 2) / FS, 0, ZS / FS, ox, oy);
    }
  }

  private drawWalls(ctx: CanvasRenderingContext2D, room: RoomInfo, wallId: string, t: number) {
    const st = getStyle(wallId) ?? getStyle('parede-branca');
    const H = room.wallH;
    const hp = H * FS;
    // parede esquerda: segmentos da esquerda (y=D) para a direita (y=0)
    for (let i = 0; i < room.D; i++) {
      const y = room.D - i;
      ctx.save();
      this.wallFace(ctx, 'L', y, H);
      ctx.beginPath(); ctx.rect(0, 0, FS, hp); ctx.clip();
      st.paint(ctx, FS, hp, i + 100, 0, t);
      ctx.fillStyle = 'rgba(0,0,0,0.14)'; ctx.fillRect(0, 0, FS, hp); // face mais escura
      ctx.restore();
    }
    for (let x = 0; x < room.W; x++) {
      ctx.save();
      this.wallFace(ctx, 'R', x, H);
      ctx.beginPath(); ctx.rect(0, 0, FS, hp); ctx.clip();
      st.paint(ctx, FS, hp, x, 0, t);
      ctx.restore();
    }
    // espessura (topo) e contornos
    const P = (x: number, y: number, z: number) => [this.O.x + isoX(x, y), this.O.y + isoY(x, y, z)] as const;
    const th = 0.22;
    ctx.fillStyle = shade('#cfc8b8', -0.1);
    const poly = (pts: (readonly [number, number])[], c: string) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = c; ctx.fill(); };
    const capC = '#e6dfcf';
    poly([P(0, room.D, H), P(0, 0, H), P(-th, -th, H), P(-th, room.D, H)], capC);
    poly([P(0, 0, H), P(room.W, 0, H), P(room.W, -th, H), P(-th, -th, H)], shade(capC, -0.05));
    // laterais externas das extremidades
    poly([P(-th, room.D, H), P(0, room.D, H), P(0, room.D, -0.15), P(-th, room.D, -0.15)], shade(capC, -0.35));
    poly([P(room.W, -th, H), P(room.W, 0, H), P(room.W, 0, -0.15), P(room.W, -th, -0.15)], shade(capC, -0.45));
    // base do piso (espessura)
    poly([P(0, room.D, 0), P(room.W, room.D, 0), P(room.W, room.D, -0.15), P(0, room.D, -0.15)], '#3a3442');
    poly([P(room.W, 0, 0), P(room.W, room.D, 0), P(room.W, room.D, -0.15), P(room.W, 0, -0.15)], '#2c2734');
    ctx.strokeStyle = 'rgba(20,14,28,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const l = [P(-th, room.D, -0.15), P(-th, room.D, H), P(-th, -th, H), P(room.W, -th, H), P(room.W, -th, -0.15)];
    l.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    // canto interno
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); const c0 = P(0, 0, 0), c1 = P(0, 0, H); ctx.moveTo(c0[0], c0[1]); ctx.lineTo(c1[0], c1[1]); ctx.stroke();
  }

  private drawWallItem(ctx: CanvasRenderingContext2D, def: ItemDef, p: Placement, t: number, highlight: number, alpha = 1, tint?: string) {
    if (!def.wallPaint) return;
    const side = p.rot === 1 ? 'R' : 'L';
    const pos = p.rot === 1 ? p.x : p.y + def.w; // na parede esquerda, a origem é a ponta de y maior
    const z = (def.wallZ ?? 0) + (def.wallH ?? 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    this.wallFace(ctx, side, pos, z);
    const w = def.w * FS, h = (def.wallH ?? 1) * FS;
    ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();
    def.wallPaint(ctx, w, h, t);
    if (side === 'L') { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(0, 0, w, h); }
    if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, w, h); }
    if (highlight) { ctx.strokeStyle = `rgba(255,255,255,${0.6 + Math.sin(this.t * 6) * 0.3})`; ctx.lineWidth = 2; ctx.strokeRect(1, 1, w - 2, h - 2); }
    ctx.restore();
  }

  private drawFloor(ctx: CanvasRenderingContext2D, room: RoomInfo, floorId: string, t: number) {
    const st = getStyle(floorId) ?? getStyle('piso-ceramica-branca');
    for (let x = 0; x < room.W; x++) for (let y = 0; y < room.D; y++) {
      ctx.save();
      const ox = this.O.x + isoX(x, y), oy = this.O.y + isoY(x, y, 0);
      ctx.transform((TW / 2) / FS, (TH / 2) / FS, -(TW / 2) / FS, (TH / 2) / FS, ox, oy);
      ctx.beginPath(); ctx.rect(0, 0, FS, FS); ctx.clip();
      st.paint(ctx, FS, FS, x, y, t);
      ctx.restore();
    }
    // sombra das paredes no piso
    ctx.save();
    const g1 = ctx.createLinearGradient(this.O.x + isoX(0, room.D / 2), this.O.y + isoY(0, room.D / 2), this.O.x + isoX(0.8, room.D / 2), this.O.y + isoY(0.8, room.D / 2));
    g1.addColorStop(0, 'rgba(0,0,0,0.25)'); g1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g1;
    const P = (x: number, y: number) => [this.O.x + isoX(x, y), this.O.y + isoY(x, y)] as const;
    let pts = [P(0, 0), P(0.8, 0), P(0.8, room.D), P(0, room.D)];
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.fill();
    const g2 = ctx.createLinearGradient(this.O.x + isoX(room.W / 2, 0), this.O.y + isoY(room.W / 2, 0), this.O.x + isoX(room.W / 2, 0.8), this.O.y + isoY(room.W / 2, 0.8));
    g2.addColorStop(0, 'rgba(0,0,0,0.18)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    pts = [P(0, 0), P(room.W, 0), P(room.W, 0.8), P(0, 0.8)];
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.fill();
    ctx.restore();
  }

  private drawGrid(ctx: CanvasRenderingContext2D, room: RoomInfo) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= room.W; x++) { const a = [this.O.x + isoX(x, 0), this.O.y + isoY(x, 0)], b = [this.O.x + isoX(x, room.D), this.O.y + isoY(x, room.D)]; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    for (let y = 0; y <= room.D; y++) { const a = [this.O.x + isoX(0, y), this.O.y + isoY(0, y)], b = [this.O.x + isoX(room.W, y), this.O.y + isoY(room.W, y)]; ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    ctx.stroke();
    ctx.restore();
  }

  private drawGhost(ctx: CanvasRenderingContext2D, t: number) {
    const hp = this.hoverPlace!, pl = this.place!;
    const def = getItem(pl.defId);
    if (!def) return;
    const tint = hp.ok ? 'rgba(80,255,140,0.25)' : 'rgba(255,60,60,0.35)';
    if (def.place === 'wall') {
      this.drawWallItem(ctx, def, hp.p, t, 1, 0.8, tint);
      return;
    }
    const fp = rotFootprint(def.w, def.d, hp.p.rot);
    ctx.save();
    ctx.fillStyle = tint;
    for (let x = hp.p.x; x < hp.p.x + fp.w; x++) for (let y = hp.p.y; y < hp.p.y + fp.d; y++) {
      ctx.beginPath();
      const P = (a: number, b: number) => [this.O.x + isoX(a, b), this.O.y + isoY(a, b)];
      [P(x, y), P(x + 1, y), P(x + 1, y + 1), P(x, y + 1)].forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
      ctx.fill();
    }
    ctx.restore();
    const z = this.room ? checkPlacement(this.room, def, hp.p, pl.uid).z : 0;
    const ds = depthSort(this.itemDrawables(def, hp.p.x, hp.p.y, z, hp.p.rot, -1, hp.ok ? 0.85 : 0.55));
    for (const d of ds) this.drawDrawable(ctx, d, t);
  }

  private applyLighting(ctx: CanvasRenderingContext2D, room: RoomInfo, themeId: string, t: number) {
    const theme = LIGHT_THEMES[themeId] ?? LIGHT_THEMES.neutra;
    const hour = new Date().getHours();
    const night = hour < 6 || hour >= 19 ? 0.12 : 0;
    const amb = Math.min(0.7, theme.ambient + night);
    const L = this.lctx;
    L.setTransform(1, 0, 0, 1, 0, 0);
    L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, this.light.width, this.light.height);
    L.fillStyle = `rgba(12,8,28,${amb})`;
    L.fillRect(0, 0, this.light.width, this.light.height);
    const lights: { x: number; y: number; r: number; c: string }[] = [];
    for (const pi of room.placed) {
      const li = pi.def.light;
      if (!li) continue;
      let lx: number, ly: number, lz: number;
      if (pi.def.place === 'wall') {
        const along = (pi.p.rot === 1 ? pi.p.x : pi.p.y) + pi.def.w / 2;
        lx = pi.p.rot === 1 ? along : 0.3; ly = pi.p.rot === 1 ? 0.3 : along; lz = li.z;
      } else {
        const fp = rotFootprint(pi.def.w, pi.def.d, pi.p.rot);
        const rp = li.x != null ? rotatePoint(li.x, li.y ?? 0.5, pi.def.w, pi.def.d, pi.p.rot) : { x: fp.w / 2, y: fp.d / 2 };
        lx = pi.p.x + rp.x; ly = pi.p.y + rp.y; lz = pi.z + li.z;
      }
      const flicker = pi.def.sad && !this.reduceMotion ? (Math.sin(t * 13) > 0.97 ? 0.4 : 1) : 1;
      lights.push({ x: this.O.x + isoX(lx, ly), y: this.O.y + isoY(lx, ly, lz * 0.5), r: li.r * TW * 0.75 * flicker, c: li.color });
    }
    L.globalCompositeOperation = 'destination-out';
    for (const l of lights) {
      const g = L.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(0.55, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = g;
      L.beginPath(); L.ellipse(l.x, l.y, l.r, l.r * 0.75, 0, 0, Math.PI * 2); L.fill();
    }
    ctx.save();
    // recorta no formato do ambiente (paredes + piso) para a luz não vazar para fora
    const th = 0.22, H = room.wallH;
    const P = (x: number, y: number, z: number) => [this.O.x + isoX(x, y), this.O.y + isoY(x, y, z)];
    ctx.beginPath();
    [P(-th, -th, H), P(room.W, -th, H), P(room.W, -th, -0.15), P(room.W, room.D, -0.15), P(-th, room.D, -0.15), P(-th, room.D, H)]
      .forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.drawImage(this.light, 0, 0);
    // matiz do tema
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = theme.tint;
    ctx.fillRect(0, 0, this.world.width, this.world.height);
    ctx.globalAlpha = 1;
    // brilho colorido
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 0.8);
      g.addColorStop(0, hexA(l.c, 0.22)); g.addColorStop(1, hexA(l.c, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(l.x, l.y, l.r * 0.8, l.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------- entrada ---------------- */

  private unbind?: () => void;

  private bindInput() {
    const c = this.canvas;
    const pos = (e: PointerEvent | WheelEvent) => { const r = c.getBoundingClientRect(); return { x: (e.clientX - r.left) * this.dpr, y: (e.clientY - r.top) * this.dpr }; };
    const down = (e: PointerEvent) => {
      c.setPointerCapture(e.pointerId);
      const p = pos(e);
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.drag = { sx: p.x, sy: p.y, cx: this.cam.x, cy: this.cam.y, moved: true, pinch: { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.cam.zoom } };
      } else {
        this.drag = { sx: p.x, sy: p.y, cx: this.cam.x, cy: this.cam.y, moved: false };
      }
    };
    const move = (e: PointerEvent) => {
      const p = pos(e);
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
      if (this.drag?.pinch && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const target = this.drag.pinch.zoom * (d / this.drag.pinch.d);
        this.zoomBy(target / this.cam.zoom, mid.x, mid.y);
        return;
      }
      if (this.drag && this.pointers.size === 1) {
        const dx = p.x - this.drag.sx, dy = p.y - this.drag.sy;
        if (!this.drag.moved && Math.hypot(dx, dy) > 8 * this.dpr) this.drag.moved = true;
        if (this.drag.moved && !(this.mode === 'place' && e.pointerType !== 'mouse' && false)) {
          this.cam.x = this.drag.cx - dx / this.cam.zoom;
          this.cam.y = this.drag.cy - dy / this.cam.zoom;
          this.camTarget = null;
        }
      }
      this.hover(p.x, p.y);
    };
    const up = (e: PointerEvent) => {
      const p = pos(e);
      const wasDrag = this.drag?.moved;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 0) {
        if (!wasDrag) { this.hover(p.x, p.y); this.click(p.x, p.y); }
        this.drag = null;
      }
    };
    const wheel = (e: WheelEvent) => { e.preventDefault(); const p = pos(e); this.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y); };
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      if (e.key === 'r' || e.key === 'R') this.rotatePlace();
      if (e.key === '+' || e.key === '=') this.zoomBy(1.15);
      if (e.key === '-') this.zoomBy(1 / 1.15);
    };
    const leave = () => { this.hoverUid = null; };
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', leave);
    c.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', key);
    this.unbind = () => {
      c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', up);
      c.removeEventListener('pointercancel', up); c.removeEventListener('pointerleave', leave); c.removeEventListener('wheel', wheel); window.removeEventListener('keydown', key);
    };
  }

  /** item sob o ponto (coordenadas de tela do canvas) */
  pick(sx: number, sy: number): number | null {
    if (!this.room) return null;
    const w = this.screenToWorld(sx, sy);
    const list = this.insertActors();
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      if (d.kind === 'actor') continue;
      const lx = w.x - this.O.x, ly = w.y - this.O.y; // limites de tela são relativos à origem O
      if (lx < d.sx0 || lx > d.sx1 || ly < d.sy0 || ly > d.sy1) continue;
      if (d.kind === 'box') {
        if (pointInBox(d, w.x - this.O.x, w.y - this.O.y)) return d.uid;
      } else if (Math.abs(w.x - d.sx) < 14 && w.y > d.sy - 40 && w.y < d.sy + 4) return d.uid;
    }
    // itens de parede
    const hitWall = this.wallHit(w.x - this.O.x, w.y - this.O.y);
    if (hitWall) {
      for (const pi of this.room.placed) {
        if (pi.def.place !== 'wall') continue;
        const side = pi.p.rot === 1 ? 'R' : 'L';
        if (side !== hitWall.side) continue;
        const pos = pi.p.rot === 1 ? pi.p.x : pi.p.y;
        const z0 = pi.def.wallZ ?? 0, z1 = z0 + (pi.def.wallH ?? 1);
        if (hitWall.along >= pos && hitWall.along <= pos + pi.def.w && hitWall.z >= z0 && hitWall.z <= z1) return pi.item.uid;
      }
    }
    for (const d of this.flatList) {
      if (d.kind === 'actor') continue;
      const lx = w.x - this.O.x, ly = w.y - this.O.y;
      if (lx < d.sx0 || lx > d.sx1 || ly < d.sy0 - 6 || ly > d.sy1 + 6) continue;
      const tile = screenToTile(w.x - this.O.x, w.y - this.O.y);
      if (tile.x >= d.x0 - 0.05 && tile.x <= d.x1 + 0.05 && tile.y >= d.y0 - 0.05 && tile.y <= d.y1 + 0.05) return d.uid;
    }
    return null;
  }

  private wallHit(wx: number, wy: number): { side: 'L' | 'R'; along: number; z: number } | null {
    const room = this.room!;
    // parede esquerda (x=0): sx = -y*32  -> y = -sx/32 ; sy = y*16 - z*32
    const yL = -wx / (TW / 2);
    const zL = (yL * (TH / 2) - wy) / ZS;
    if (yL >= 0 && yL <= room.D && zL >= 0 && zL <= room.wallH) return { side: 'L', along: yL, z: zL };
    const xR = wx / (TW / 2);
    const zR = (xR * (TH / 2) - wy) / ZS;
    if (xR >= 0 && xR <= room.W && zR >= 0 && zR <= room.wallH) return { side: 'R', along: xR, z: zR };
    return null;
  }

  private updateHoverPlace(x: number, y: number, isWallItem: boolean) {
    if (!this.place || !this.room || !this.save) return;
    const def = getItem(this.place.defId)!;
    const p: Placement = isWallItem
      ? { propertyId: this.room.propertyId, x: this.place.rot === 1 ? x : 0, y: this.place.rot === 1 ? 0 : y, rot: this.place.rot }
      : { propertyId: this.room.propertyId, x, y, rot: this.place.rot };
    const chk = checkPlacement(this.room, def, p, this.place.uid);
    this.hoverPlace = { p, ok: chk.ok, reason: chk.reason };
  }

  private hover(sx: number, sy: number) {
    if (!this.room) return;
    if (this.mode === 'place' && this.place) {
      const def = getItem(this.place.defId)!;
      const w = this.screenToWorld(sx, sy);
      if (def.place === 'wall') {
        const hit = this.wallHit(w.x - this.O.x, w.y - this.O.y);
        if (hit) {
          this.place.rot = hit.side === 'R' ? 1 : 0;
          const pos = Math.round(hit.along - def.w / 2);
          this.updateHoverPlace(pos, pos, true);
        } else {
          // projeta no chão e escolhe a parede mais próxima
          const tl = screenToTile(w.x - this.O.x, w.y - this.O.y);
          const side = tl.x < tl.y ? 0 : 1;
          this.place.rot = side;
          const pos = Math.round((side === 1 ? tl.x : tl.y) - def.w / 2);
          this.updateHoverPlace(pos, pos, true);
        }
        return;
      }
      const fp = rotFootprint(def.w, def.d, this.place.rot);
      let tl = screenToTile(w.x - this.O.x, w.y - this.O.y, 0);
      if (def.place === 'top') {
        // procura uma superfície (mesa, cômoda...) sob o cursor, da mais alta para a mais baixa
        const surfs = this.room.placed.filter((p) => p.def.place === 'floor' && p.def.surface).sort((a, b) => b.def.surface! - a.def.surface!);
        for (const sp of surfs) {
          const t2 = screenToTile(w.x - this.O.x, w.y - this.O.y, sp.def.surface!);
          if (t2.x >= sp.p.x && t2.x < sp.p.x + sp.w && t2.y >= sp.p.y && t2.y < sp.p.y + sp.d) { tl = t2; break; }
        }
      }
      const x = Math.floor(tl.x - (fp.w - 1) / 2), y = Math.floor(tl.y - (fp.d - 1) / 2);
      this.updateHoverPlace(x, y, false);
      return;
    }
    this.hoverUid = this.pick(sx, sy);
    this.canvas.style.cursor = this.hoverUid != null ? 'pointer' : 'default';
  }

  private click(sx: number, sy: number) {
    if (!this.room) return;
    if (this.mode === 'place' && this.place) {
      if (!this.hoverPlace) return;
      if (!this.hoverPlace.ok) { this.cb.onPlaceInvalid?.(this.hoverPlace.reason ?? 'Posição inválida'); return; }
      this.cb.onPlace?.(this.hoverPlace.p, this.place);
      return;
    }
    const uid = this.pick(sx, sy);
    if (this.mode === 'edit') {
      this.selected = uid;
      this.cb.onSelect?.(uid);
      return;
    }
    if (uid != null) {
      const pi = this.room.placed.find((p) => p.item.uid === uid);
      if (pi) { this.cb.onItemClick?.(uid, pi.def); this.interact(uid); }
      return;
    }
    const w = this.screenToWorld(sx, sy);
    const tl = screenToTile(w.x - this.O.x, w.y - this.O.y);
    const tx = Math.floor(tl.x), ty = Math.floor(tl.y);
    if (tx >= 0 && ty >= 0 && tx < this.room.W && ty < this.room.D) {
      if (!this.walkTo(tx, ty)) this.cb.onHint?.('Não dá para chegar aí.');
    }
  }
}

function hexA(c: string, a: number) {
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1, 7), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  return c;
}

function pointInBox(d: DrawBox, px: number, py: number) {
  const P = (x: number, y: number, z: number) => [isoX(x, y), isoY(x, y, z)];
  const pts = [P(d.x0, d.y0, d.z1), P(d.x1, d.y0, d.z1), P(d.x1, d.y0, d.z0), P(d.x1, d.y1, d.z0), P(d.x0, d.y1, d.z0), P(d.x0, d.y1, d.z1)];
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi || 1e-9) + xi) inside = !inside;
  }
  // tolerância para itens muito finos
  if (!inside && d.z1 - d.z0 < 0.08) {
    const cx = (pts[0][0] + pts[3][0]) / 2, cy = (pts[0][1] + pts[3][1]) / 2;
    return Math.abs(px - cx) < 10 && Math.abs(py - cy) < 6;
  }
  return inside;
}

export { hsl };
