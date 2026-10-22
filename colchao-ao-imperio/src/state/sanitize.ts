import { isValidISODate, todayISO } from '../core/dates';
import { getItem } from '../game/catalog';
import { PROPERTIES, getProperty } from '../game/properties';
import { getStyle } from '../game/styles';
import type {
  Account, AccountType, Budget, Category, CoinEntry, Goal, OwnedItem, RecurringRule, RoomState, SaveData, Transaction,
} from './types';

/**
 * Sanitização defensiva de um save vindo do armazenamento ou de um backup colado/editado.
 * Nunca lança por dado "estranho": descarta ou corrige o que for inválido e conta os reparos,
 * para que um backup danificado não deixe o jogo travado.
 */
export interface SanitizeReport { repairs: string[] }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const int = (v: unknown): number | null => (typeof v === 'number' && Number.isSafeInteger(v) ? v : null);
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const ACC_TYPES: AccountType[] = ['checking', 'savings', 'cash', 'investment', 'reserve', 'credit_card', 'debt'];
const date = (v: unknown, d = todayISO()) => (typeof v === 'string' && isValidISODate(v) ? v : d);

export function sanitizeInto(base: SaveData, raw: Record<string, unknown>, rep: SanitizeReport): SaveData {
  const drop = (what: string, n: number) => { if (n > 0) rep.repairs.push(`${n} ${what} inválido(s) removido(s)`); };

  /* ---------- finanças ---------- */
  const f = isObj(raw.finance) ? raw.finance : {};
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);

  const accounts: Account[] = [];
  let bad = 0;
  for (const a of arr(f.accounts)) {
    if (!isObj(a) || !str(a.id) || !ACC_TYPES.includes(a.type as AccountType) || int(a.initialBalance) === null) { bad++; continue; }
    accounts.push({ ...(a as unknown as Account), name: str(a.name, 'Conta'), openedAt: date(a.openedAt), color: str(a.color, '#60a5fa'), createdAt: num(a.createdAt, Date.now()) });
  }
  drop('conta(s)', bad);
  const accIds = new Set(accounts.map((a) => a.id));
  for (const a of accounts) {
    if (a.debt && (!isObj(a.debt) || int(a.debt.installmentAmount) === null || !Number.isInteger(a.debt.installmentsTotal) || !isValidISODate(str(a.debt.firstDueDate)))) {
      a.debt = undefined; rep.repairs.push(`plano de parcelas de "${a.name}" removido`);
    }
  }

  const categories: Category[] = arr(f.categories).filter((c): c is Category => isObj(c) && !!str(c.id) && !!str(c.name) && (c.kind === 'income' || c.kind === 'expense'));
  for (const c of base.finance.categories) if (!categories.some((x) => x.id === c.id)) categories.push(c);

  const transactions: Transaction[] = [];
  bad = 0;
  for (const t of arr(f.transactions)) {
    if (!isObj(t) || !str(t.id) || !['income', 'expense', 'transfer', 'adjustment'].includes(str(t.kind)) || int(t.amount) === null
      || !isValidISODate(str(t.date)) || !accIds.has(str(t.accountId)) || (t.kind === 'transfer' && !accIds.has(str(t.toAccountId)))) { bad++; continue; }
    const tx = { ...(t as unknown as Transaction), description: str(t.description), status: t.status === 'pending' ? 'pending' : 'confirmed', createdAt: num(t.createdAt, Date.now()), updatedAt: num(t.updatedAt, Date.now()) } as Transaction;
    if (tx.installments && (!Array.isArray(tx.installments.amounts) || tx.installments.amounts.reduce((x, y) => x + y, 0) !== tx.amount)) tx.installments = undefined;
    if (!Array.isArray(tx.history)) tx.history = undefined;
    transactions.push(tx);
  }
  drop('lançamento(s)', bad);

  const recurring: RecurringRule[] = arr(f.recurring).filter((r): r is RecurringRule => isObj(r) && !!str(r.id) && int(r.amount) !== null && accIds.has(str(r.accountId)) && isValidISODate(str(r.startDate)) && ['monthly', 'weekly', 'yearly'].includes(str(r.frequency)));
  drop('recorrência(s)', arr(f.recurring).length - recurring.length);
  const goals: Goal[] = arr(f.goals).filter((g): g is Goal => isObj(g) && !!str(g.id) && int(g.target) !== null).map((g) => ({ ...g, accountId: g.accountId && accIds.has(g.accountId) ? g.accountId : undefined }));
  const budgets: Budget[] = arr(f.budgets).filter((b): b is Budget => isObj(b) && !!str(b.categoryId) && int(b.limit) !== null);
  const audit = arr(f.audit).filter((x) => isObj(x)).slice(-3000) as unknown as SaveData['finance']['audit'];

  /* ---------- jogo ---------- */
  const g = isObj(raw.game) ? raw.game : {};
  const owned = arr(g.ownedProperties).filter((p): p is string => typeof p === 'string' && !!getProperty(p));
  if (!owned.includes(PROPERTIES[0].id)) owned.unshift(PROPERTIES[0].id);
  const current = typeof g.currentProperty === 'string' && owned.includes(g.currentProperty) ? g.currentProperty : owned[0];
  if (g.currentProperty !== current && g.currentProperty !== undefined) rep.repairs.push('imóvel atual inválido: voltou para um imóvel válido');

  const inventory: OwnedItem[] = [];
  bad = 0;
  const seen = new Set<number>();
  for (const it of arr(g.inventory)) {
    if (!isObj(it) || int(it.uid) === null || seen.has(it.uid as number) || !getItem(str(it.defId))) { bad++; continue; }
    seen.add(it.uid as number);
    let placed = it.placed as OwnedItem['placed'];
    if (placed && (!isObj(placed) || !owned.includes(str(placed.propertyId)) || int(placed.x) === null || int(placed.y) === null || int(placed.rot) === null)) placed = null;
    inventory.push({ uid: it.uid as number, defId: str(it.defId), placed, acquiredAt: num(it.acquiredAt, Date.now()), locked: !!it.locked, gift: !!it.gift });
  }
  drop('móvel(is)', bad);
  if (!inventory.length) inventory.push(...base.game.inventory);
  const nextUid = Math.max(int(g.nextUid) ?? 1, ...inventory.map((i) => i.uid + 1));

  const coinLedger: CoinEntry[] = arr(g.coinLedger).filter((e): e is CoinEntry => isObj(e) && Number.isFinite(e.amount as number) && typeof e.kind === 'string');
  const rooms: Record<string, RoomState> = {};
  const rawRooms = isObj(g.rooms) ? g.rooms : {};
  for (const pid of owned) {
    const p = getProperty(pid)!;
    const r = isObj(rawRooms[pid]) ? (rawRooms[pid] as Record<string, unknown>) : {};
    rooms[pid] = {
      floor: getStyle(str(r.floor)) ? str(r.floor) : p.floor,
      wall: getStyle(str(r.wall)) ? str(r.wall) : p.wall,
      light: str(r.light, p.light),
      expansion: Math.max(0, Math.min(p.maxExpansion, int(r.expansion) ?? 0)),
      layouts: arr(r.layouts).filter((l) => isObj(l) && Array.isArray(l.items)) as RoomState['layouts'],
    };
  }
  const claims: SaveData['game']['claims'] = {};
  if (isObj(g.claims)) for (const [k, v] of Object.entries(g.claims)) if (isObj(v) && Number.isFinite(v.coins as number)) claims[k] = { at: num(v.at, 0), coins: v.coins as number, xp: num(v.xp, 0), label: str(v.label) };
  const strArr = (v: unknown) => arr(v).filter((x): x is string => typeof x === 'string');

  const p = isObj(raw.profile) ? raw.profile : {};
  const avatarRaw = isObj(p.avatar) ? p.avatar : {};
  const avatar = { ...base.profile.avatar };
  for (const k of Object.keys(avatar) as (keyof typeof avatar)[]) { const v = int(avatarRaw[k]); if (v !== null && v >= 0) avatar[k] = v; }
  const settings = { ...base.settings };
  if (isObj(raw.settings)) for (const k of Object.keys(settings) as (keyof typeof settings)[]) if (typeof raw.settings[k] === 'boolean') settings[k] = raw.settings[k] as boolean;

  return {
    ...base,
    savedAt: num(raw.savedAt, Date.now()),
    createdAt: num(raw.createdAt, Date.now()),
    profile: {
      name: str(p.name).slice(0, 40), avatar, titleId: typeof p.titleId === 'string' ? p.titleId : base.profile.titleId,
      onboarded: !!p.onboarded, onboardingStep: Math.max(0, Math.min(6, int(p.onboardingStep) ?? 0)),
    },
    settings,
    finance: { accounts, categories, transactions, recurring, goals, budgets, audit },
    game: {
      ...base.game,
      inventory, nextUid, coinLedger, ownedProperties: owned, currentProperty: current, rooms,
      ownedStyles: [...new Set([...strArr(g.ownedStyles).filter((x) => getStyle(x)), ...owned.flatMap((pid) => [getProperty(pid)!.floor, getProperty(pid)!.wall])])],
      ownedCosmetics: strArr(g.ownedCosmetics),
      activityDays: strArr(g.activityDays).filter(isValidISODate),
      claims,
      seenAchievements: isObj(g.seenAchievements) ? (g.seenAchievements as Record<string, number>) : {},
      seenLevel: Math.max(1, int(g.seenLevel) ?? 1),
      visits: isObj(g.visits) ? (g.visits as Record<string, number>) : {},
      wishlist: strArr(g.wishlist).filter((x) => getItem(x)),
    },
  };
}
