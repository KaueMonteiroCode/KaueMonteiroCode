import { todayISO } from '../core/dates';
import { DEFAULT_AVATAR } from '../engine/avatar';
import { PROPERTIES } from '../game/properties';
import type { Category, OwnedItem, RoomState, SaveData } from './types';
import { SAVE_VERSION } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-salario', name: 'Salário', kind: 'income', color: '#4ade80', icon: 'money', system: true },
  { id: 'cat-freela', name: 'Trabalho extra', kind: 'income', color: '#22d3ee', icon: 'work', system: true },
  { id: 'cat-economia', name: 'Economia guardada', kind: 'income', color: '#a3e635', icon: 'pig', system: true },
  { id: 'cat-rendimento', name: 'Rendimentos', kind: 'income', color: '#fbbf24', icon: 'chart', system: true },
  { id: 'cat-outras-receitas', name: 'Outras receitas', kind: 'income', color: '#94a3b8', icon: 'plus', system: true },
  { id: 'cat-moradia', name: 'Moradia', kind: 'expense', color: '#f87171', icon: 'house', system: true },
  { id: 'cat-mercado', name: 'Mercado', kind: 'expense', color: '#fb923c', icon: 'cart', system: true },
  { id: 'cat-transporte', name: 'Transporte', kind: 'expense', color: '#facc15', icon: 'bus', system: true },
  { id: 'cat-contas', name: 'Contas (luz, água, internet)', kind: 'expense', color: '#60a5fa', icon: 'bolt', system: true },
  { id: 'cat-saude', name: 'Saúde', kind: 'expense', color: '#f472b6', icon: 'heart', system: true },
  { id: 'cat-educacao', name: 'Educação', kind: 'expense', color: '#a78bfa', icon: 'book', system: true },
  { id: 'cat-lazer', name: 'Lazer', kind: 'expense', color: '#2dd4bf', icon: 'game', system: true },
  { id: 'cat-assinaturas', name: 'Assinaturas', kind: 'expense', color: '#c084fc', icon: 'tv', system: true },
  { id: 'cat-delivery', name: 'Delivery e restaurantes', kind: 'expense', color: '#fdba74', icon: 'food', system: true },
  { id: 'cat-juros', name: 'Juros e tarifas', kind: 'expense', color: '#ef4444', icon: 'alert', system: true },
  { id: 'cat-outras-despesas', name: 'Outras despesas', kind: 'expense', color: '#9ca3af', icon: 'minus', system: true },
];

export function roomDefaults(propertyId: string): RoomState {
  const p = PROPERTIES.find((x) => x.id === propertyId)!;
  return { floor: p.floor, wall: p.wall, light: p.light, expansion: 0, layouts: [] };
}

export function starterItems(propertyId: string, startUid: number): OwnedItem[] {
  const p = PROPERTIES.find((x) => x.id === propertyId)!;
  return p.starter.map((s, i) => ({
    uid: startUid + i,
    defId: s.defId,
    placed: { propertyId, x: s.x, y: s.y, rot: s.rot },
    acquiredAt: Date.now(),
    locked: s.locked,
    gift: true,
  }));
}

export function newSave(): SaveData {
  const first = PROPERTIES[0].id;
  const items = starterItems(first, 1);
  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    createdAt: Date.now(),
    profile: { name: '', avatar: { ...DEFAULT_AVATAR }, titleId: 't-colchao', onboarded: false, onboardingStep: 0 },
    settings: { sound: true, music: false, reduceMotion: false, showGrid: false },
    finance: { accounts: [], categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })), transactions: [], recurring: [], goals: [], budgets: [], audit: [] },
    game: {
      inventory: items,
      nextUid: items.length + 1,
      coinLedger: [],
      ownedProperties: [first],
      currentProperty: first,
      rooms: { [first]: roomDefaults(first) },
      ownedStyles: [PROPERTIES[0].floor, PROPERTIES[0].wall],
      ownedCosmetics: [],
      activityDays: [],
      claims: {},
      seenAchievements: {},
      seenLevel: 1,
      visits: {},
    },
  };
}

/** Migração/sanitização de saves antigos ou importados */
export function normalizeSave(raw: unknown): SaveData {
  const base = newSave();
  const s = raw as Partial<SaveData>;
  if (!s || typeof s !== 'object' || !s.finance || !s.game || !s.profile) throw new Error('Arquivo de save inválido');
  const out: SaveData = {
    ...base,
    ...s,
    version: SAVE_VERSION,
    profile: { ...base.profile, ...s.profile, avatar: { ...base.profile.avatar, ...(s.profile?.avatar ?? {}) } },
    settings: { ...base.settings, ...(s.settings ?? {}) },
    finance: { ...base.finance, ...s.finance },
    game: { ...base.game, ...s.game, rooms: { ...(s.game?.rooms ?? base.game.rooms) } },
  } as SaveData;
  for (const k of ['accounts', 'categories', 'transactions', 'recurring', 'goals', 'budgets', 'audit'] as const) {
    if (!Array.isArray(out.finance[k])) (out.finance as unknown as Record<string, unknown[]>)[k] = [];
  }
  for (const t of out.finance.transactions) {
    if (!Number.isSafeInteger(t.amount)) throw new Error(`Lançamento com valor inválido: ${t.id}`);
  }
  for (const pid of out.game.ownedProperties) if (!out.game.rooms[pid]) out.game.rooms[pid] = roomDefaults(pid);
  return out;
}

export { todayISO };
