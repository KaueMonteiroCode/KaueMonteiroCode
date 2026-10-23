/**
 * Monta o escritório: uma estação temática por robô (tapete com LED da cor dele, mesa colorida,
 * dois monitores, PC e cadeira gamer) + área de convivência. Reaproveita o motor do jogo.
 */
import { DEFAULT_AVATAR, CLOTH_COLORS } from '../engine/avatar';
import { shade } from '../engine/iso';
import { getItem, models, registerItem, type ItemDef } from '../game/catalog';
import { registerProperty, type PropertyDef } from '../game/properties';
import { checkPlacement, roomInfo } from '../game/room';
import { newSave } from '../state/defaults';
import type { AvatarConfig, OwnedItem, SaveData } from '../state/types';
import type { AgentSpec } from '../engine/engine';
import type { AgentConfig } from './types';

export const OFFICE_ID = 'escritorio-robos';

function themed(a: AgentConfig) {
  const c = a.color;
  const { chairModel, deskModel, rug, rect } = models;
  const desk: ItemDef = { id: `of-mesa-${a.id}`, name: `Mesa de ${a.name}`, cat: 'mesas', price: 0, rarity: 'raro', w: 3, d: 1, place: 'floor', surface: 0.74, fixture: true, model: deskModel('office', shade(c, -0.12), 3) };
  const chair: ItemDef = { id: `of-cadeira-${a.id}`, name: `Cadeira de ${a.name}`, cat: 'cadeiras', price: 0, rarity: 'raro', w: 1, d: 1, place: 'floor', sit: 0.49, fixture: true, model: chairModel('gamer', '#1d1e24', c) };
  const mat: ItemDef = {
    id: `of-tapete-${a.id}`, name: `Tapete LED de ${a.name}`, cat: 'tapetes', price: 0, rarity: 'raro', w: 3, d: 3, place: 'rug', fixture: true,
    light: { color: c, r: 2.4, z: 0.6 },
    model: rug(3, 3, (ctx, w, h, t) => {
      rect(ctx, 0, 0, w, h, shade(c, -0.62));
      ctx.globalAlpha = 0.55 + Math.sin(t * 2) * 0.2;
      ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.globalAlpha = 1;
      ctx.fillStyle = shade(c, -0.45);
      for (let x = 8; x < w - 6; x += 10) for (let y = 8; y < h - 6; y += 10) ctx.fillRect(x, y, 2, 2);
    }),
  };
  for (const d of [desk, chair, mat]) registerItem(d, true);
  return { desk: desk.id, chair: chair.id, mat: mat.id };
}

/** Índice da cor de roupa mais parecida com a cor do robô */
function nearestCloth(hex: string) {
  const rgb = (h: string) => { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const [r, g, b] = rgb(hex);
  let best = 0, bd = Infinity;
  CLOTH_COLORS.forEach((c, i) => { const [r2, g2, b2] = rgb(c); const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2; if (d < bd) { bd = d; best = i; } });
  return best;
}

export function agentAvatar(a: AgentConfig, i: number): AvatarConfig {
  const v = a.avatar ?? {};
  return {
    ...DEFAULT_AVATAR,
    skin: v.skin ?? (i * 2) % 6, hairStyle: v.hairStyle ?? (i * 3 + 1) % 10, hairColor: v.hairColor ?? (i * 5) % 10,
    eyes: i % 4, mouth: i % 2, shirtStyle: v.shirtStyle ?? 3, shirtColor: nearestCloth(a.color), pantsStyle: 0, pantsColor: 1,
    shoesColor: 1, accessory: v.accessory ?? 3, beard: v.beard ?? 0,
  };
}

export interface OfficeBuild { save: SaveData; specs: AgentSpec[]; size: { w: number; d: number } }

export function buildOffice(agents: AgentConfig[], bossName: string, bossAvatar?: AvatarConfig): OfficeBuild {
  const n = Math.max(1, agents.length);
  const cols = n <= 4 ? 2 : n <= 9 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const lounge = 5;
  const W = 1 + cols * 4 + lounge;
  const D = Math.max(11, 2 + rows * 5);
  const prop: PropertyDef = {
    id: OFFICE_ID, order: 99, name: 'Escritório dos robôs', desc: '', w: W, d: D, maxExpansion: 0, wallH: 3.2,
    floor: 'piso-carpete-placa', wall: 'parede-concreto', light: 'neon', price: 0, req: { level: 1, gainCents: 0 }, npcs: 0, outside: '#0b0a14', starter: [],
  };
  registerProperty(prop);
  const save = newSave();
  const items: OwnedItem[] = [];
  save.game.inventory = items;
  save.game.currentProperty = OFFICE_ID;
  save.game.ownedProperties = [OFFICE_ID];
  save.game.rooms = { [OFFICE_ID]: { floor: prop.floor, wall: prop.wall, light: prop.light, expansion: 0, layouts: [] } };
  let uid = 1;
  /** coloca um móvel só se ele existir e couber (senão pula, sem quebrar o escritório) */
  const put = (defId: string, x: number, y: number, rot = 0) => {
    const def = getItem(defId);
    if (!def) { console.warn(`[escritório] móvel inexistente: ${defId}`); return -1; }
    const it: OwnedItem = { uid, defId, placed: { propertyId: OFFICE_ID, x, y, rot }, acquiredAt: 0, locked: true, gift: true };
    const room = roomInfo(save);
    if (!checkPlacement(room, def, it.placed!).ok) return -1;
    items.push(it);
    return uid++;
  };
  const specs: AgentSpec[] = [];
  agents.forEach((a, i) => {
    const t = themed(a);
    const c = i % cols, r = Math.floor(i / cols);
    const sx = 1 + c * 4, sy = 2 + r * 5;
    put(t.mat, sx, sy - 1);
    const seat = put(t.chair, sx + 1, sy, 0);           // de frente para a câmera
    const desk = put(t.desk, sx, sy + 1, 0);            // mesa à frente do robô
    put('monitor-24-black', sx, sy + 1, 2);             // telas viradas para ele
    put('monitor-24-black', sx + 1, sy + 1, 2);
    put('teclado-basico', sx + 1, sy + 1, 2);
    put('pc-rgb1-black', sx + 2, sy + 1, 2);
    specs.push({ id: a.id, name: a.name, avatar: agentAvatar(a, i), seat, desk });
  });
  // convivência (lado direito)
  const lx = 1 + cols * 4;
  put('bebedouro', lx + 3, 1);
  put('frigobar-black', lx + 1, 1);
  put('cafeteira-espresso', lx + 1, 1);
  put('planta-palm-g-1', lx + 4, 1);
  put('planta-monstera-g-0', lx + 4, Math.floor(D / 2));
  put('sofa-3-gray', lx + 1, D - 2, 2);
  put('mesa-centro', lx + 2, D - 4);
  put('planta-fern-g-0', lx + 4, D - 1);
  put('planta-fern-g-0', 0, D - 1);
  put('lixeira', lx, D - 1);
  // paredes
  put('fixo-janelao', 2, 0, 1);
  for (let x = 6; x < lx - 1; x += 4) put('fixo-janelao', x, 0, 1);
  put('quadro-branco', lx + 1, 0, 1);
  put('relogio-parede', lx + 3, 0, 1);
  put('mural-cortica', 0, 2, 0);
  put('porta-vidro', 0, D - 3, 0);

  save.profile.name = bossName;
  save.profile.onboarded = true;
  if (bossAvatar) save.profile.avatar = bossAvatar;
  else save.profile.avatar = { ...DEFAULT_AVATAR, shirtStyle: 4, shirtColor: 1, accessory: 1, hairStyle: 1 };
  save.game.nextUid = uid;
  save.settings.sound = false;
  return { save, specs, size: { w: W, d: D } };
}
