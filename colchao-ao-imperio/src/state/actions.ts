import { addMonthKey, isValidISODate, monthKey, todayISO, type ISODate } from '../core/dates';
import { uid } from '../core/ids';
import { assertCents, formatBRL, splitInstallments, type Cents } from '../core/money';
import { debtInstallments, invoiceMonthFor } from '../finance/ledger';
import { getItem, sellPrice } from '../game/catalog';
import { computeProgress } from '../game/progress';
import { getProperty, expansionPrice, PROPERTIES } from '../game/properties';
import { checkPlacement, findFreeSpot, roomInfo } from '../game/room';
import { getStyle } from '../game/styles';
import { activeEvents } from '../game/meta';
import { PREMIUM_ACCESSORIES } from '../engine/avatar';
import { roomDefaults, starterItems } from './defaults';
import { getState, update } from './store';
import type {
  Account, AccountType, AvatarConfig, Budget, Category, Goal, Placement, RecurringRule, SaveData, Settings, Transaction,
} from './types';
import { isLiability } from './types';

export class ActionError extends Error {}
const fail = (msg: string): never => { throw new ActionError(msg); };

function audit(d: SaveData, action: string, detail: string) {
  d.finance.audit.push({ at: Date.now(), action, detail });
  if (d.finance.audit.length > 3000) d.finance.audit.splice(0, d.finance.audit.length - 3000);
}
function markActivity(d: SaveData) {
  const t = todayISO();
  if (!d.game.activityDays.includes(t)) d.game.activityDays.push(t);
}

/* ===================== CONTAS ===================== */

export interface AccountInput {
  name: string;
  type: AccountType;
  /** valor positivo digitado: para passivos significa "quanto devo" */
  initialAmount: Cents;
  openedAt?: ISODate;
  color?: string;
  creditLimit?: Cents;
  closingDay?: number;
  dueDay?: number;
  debt?: Account['debt'];
}

const ACC_COLORS = ['#4ade80', '#60a5fa', '#fbbf24', '#f472b6', '#a78bfa', '#2dd4bf', '#fb923c', '#f87171'];

export function addAccount(input: AccountInput): string {
  const name = input.name.trim();
  if (!name) fail('Dê um nome para a conta.');
  assertCents(input.initialAmount);
  if (input.initialAmount < 0 && isLiability(input.type)) fail('Informe o valor devido como número positivo.');
  const opened = input.openedAt ?? todayISO();
  if (!isValidISODate(opened)) fail('Data inválida.');
  const id = uid('acc_');
  update((d) => {
    const signed = isLiability(input.type) ? -Math.abs(input.initialAmount) : input.initialAmount;
    d.finance.accounts.push({
      id, name, type: input.type, initialBalance: signed, openedAt: opened,
      color: input.color ?? ACC_COLORS[d.finance.accounts.length % ACC_COLORS.length],
      creditLimit: input.creditLimit, closingDay: input.closingDay, dueDay: input.dueDay, debt: input.debt, createdAt: Date.now(),
    });
    audit(d, 'conta:criar', `${name} (${input.type}) saldo inicial ${formatBRL(signed)}`);
    markActivity(d);
  });
  return id;
}

export function updateAccount(id: string, patch: Partial<AccountInput> & { archived?: boolean }) {
  update((d) => {
    const a = d.finance.accounts.find((x) => x.id === id) ?? fail('Conta não encontrada');
    const before = JSON.stringify(a);
    if (patch.name !== undefined) { if (!patch.name.trim()) fail('Nome vazio'); a.name = patch.name.trim(); }
    if (patch.initialAmount !== undefined) { assertCents(patch.initialAmount); a.initialBalance = isLiability(a.type) ? -Math.abs(patch.initialAmount) : patch.initialAmount; }
    if (patch.openedAt) { if (!isValidISODate(patch.openedAt)) fail('Data inválida'); a.openedAt = patch.openedAt; }
    if (patch.color) a.color = patch.color;
    if (patch.creditLimit !== undefined) a.creditLimit = patch.creditLimit;
    if (patch.closingDay !== undefined) a.closingDay = patch.closingDay;
    if (patch.dueDay !== undefined) a.dueDay = patch.dueDay;
    if (patch.debt !== undefined) a.debt = patch.debt;
    if (patch.archived !== undefined) a.archived = patch.archived;
    audit(d, 'conta:editar', `${a.name}: ${before} -> ${JSON.stringify(a)}`);
  });
}

export function deleteAccount(id: string) {
  update((d) => {
    const used = d.finance.transactions.some((t) => !t.deleted && (t.accountId === id || t.toAccountId === id));
    if (used) fail('Esta conta tem lançamentos. Arquive-a em vez de excluir (ou exclua os lançamentos antes).');
    const a = d.finance.accounts.find((x) => x.id === id);
    d.finance.accounts = d.finance.accounts.filter((x) => x.id !== id);
    d.finance.goals.forEach((g) => { if (g.accountId === id) g.accountId = undefined; });
    audit(d, 'conta:excluir', a?.name ?? id);
  });
}

/* ===================== LANÇAMENTOS ===================== */

export interface TxInput {
  kind: Transaction['kind'];
  date: ISODate;
  amount: Cents;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  description?: string;
  status?: Transaction['status'];
  saving?: boolean;
  installments?: number; // compra parcelada (só cartão)
  recurringId?: string;
  occurrenceDate?: ISODate;
  debtInstallment?: Transaction['debtInstallment'];
}

function validateTx(d: SaveData, i: TxInput) {
  assertCents(i.amount);
  if (!isValidISODate(i.date)) fail('Data inválida.');
  if (i.kind !== 'adjustment' && i.amount <= 0) fail('O valor precisa ser maior que zero.');
  if (i.kind === 'adjustment' && i.amount === 0) fail('Ajuste de zero não muda nada.');
  const acc = d.finance.accounts.find((a) => a.id === i.accountId);
  if (!acc) fail('Escolha uma conta.');
  if (i.kind === 'transfer') {
    if (!i.toAccountId) fail('Escolha a conta de destino.');
    if (i.toAccountId === i.accountId) fail('Origem e destino são a mesma conta.');
    if (!d.finance.accounts.some((a) => a.id === i.toAccountId)) fail('Conta de destino não encontrada.');
  }
  if (i.installments && i.installments > 1) {
    if (acc!.type !== 'credit_card') fail('Parcelamento só em cartão de crédito.');
    if (i.kind !== 'expense') fail('Só despesas podem ser parceladas.');
    if (i.installments > 72) fail('Máximo de 72 parcelas.');
  }
  return acc!;
}

export function addTransaction(i: TxInput): string {
  const id = uid('tx_');
  update((d) => {
    const acc = validateTx(d, i);
    if (i.recurringId && i.occurrenceDate && d.finance.transactions.some((t) => !t.deleted && t.recurringId === i.recurringId && t.occurrenceDate === i.occurrenceDate)) fail('Esta ocorrência já foi confirmada.');
    if (i.debtInstallment) {
      const acc = d.finance.accounts.find((a) => a.id === i.debtInstallment!.debtAccountId);
      const inst = acc ? debtInstallments(d.finance, acc).find((x) => x.number === i.debtInstallment!.number) : undefined;
      if (inst?.paid) fail('Esta parcela já foi paga.');
    }
    const now = Date.now();
    const tx: Transaction = {
      id, kind: i.kind, date: i.date, amount: i.amount, accountId: i.accountId,
      toAccountId: i.kind === 'transfer' ? i.toAccountId : undefined,
      categoryId: i.kind === 'transfer' ? undefined : i.categoryId,
      description: (i.description ?? '').trim(),
      status: i.status ?? (i.date > todayISO() ? 'pending' : 'confirmed'),
      saving: i.kind === 'income' && i.saving ? true : undefined,
      recurringId: i.recurringId, occurrenceDate: i.occurrenceDate, debtInstallment: i.debtInstallment,
      createdAt: now, updatedAt: now,
    };
    if (i.installments && i.installments > 1) {
      const amounts = splitInstallments(i.amount, i.installments);
      tx.installments = { count: i.installments, amounts, firstInvoice: invoiceMonthFor(acc, i.date) };
    }
    d.finance.transactions.push(tx);
    audit(d, 'lancamento:criar', `${tx.kind} ${formatBRL(tx.amount)} em ${tx.date} — ${tx.description}`);
    markActivity(d);
  });
  return id;
}

export function editTransaction(id: string, patch: Partial<TxInput>) {
  update((d) => {
    const t = d.finance.transactions.find((x) => x.id === id) ?? fail('Lançamento não encontrado');
    const { history, ...before } = t;
    const merged: TxInput = {
      kind: patch.kind ?? t.kind, date: patch.date ?? t.date, amount: patch.amount ?? t.amount,
      accountId: patch.accountId ?? t.accountId, toAccountId: patch.toAccountId ?? t.toAccountId,
      categoryId: patch.categoryId ?? t.categoryId, description: patch.description ?? t.description,
      status: patch.status ?? t.status, saving: patch.saving ?? t.saving,
      installments: patch.installments ?? t.installments?.count,
    };
    const acc = validateTx(d, merged);
    t.kind = merged.kind; t.date = merged.date; t.amount = merged.amount; t.accountId = merged.accountId;
    t.toAccountId = merged.kind === 'transfer' ? merged.toAccountId : undefined;
    t.categoryId = merged.kind === 'transfer' ? undefined : merged.categoryId;
    t.description = (merged.description ?? '').trim();
    t.status = merged.status ?? 'confirmed';
    t.saving = merged.kind === 'income' && merged.saving ? true : undefined;
    if (merged.installments && merged.installments > 1) t.installments = { count: merged.installments, amounts: splitInstallments(merged.amount, merged.installments), firstInvoice: invoiceMonthFor(acc, merged.date) };
    else t.installments = undefined;
    t.updatedAt = Date.now();
    t.history = [...(history ?? []), { at: Date.now(), action: 'edit', before }];
    audit(d, 'lancamento:editar', `${id}: ${formatBRL(before.amount)} -> ${formatBRL(t.amount)}`);
    markActivity(d);
  });
}

export function deleteTransaction(id: string) {
  update((d) => {
    const t = d.finance.transactions.find((x) => x.id === id) ?? fail('Lançamento não encontrado');
    const { history, ...before } = t;
    t.deleted = true;
    t.deletedAt = Date.now();
    t.history = [...(history ?? []), { at: Date.now(), action: 'delete', before }];
    audit(d, 'lancamento:excluir', `${t.kind} ${formatBRL(t.amount)} em ${t.date} — ${t.description}`);
  });
}

export function restoreTransaction(id: string) {
  update((d) => {
    const t = d.finance.transactions.find((x) => x.id === id) ?? fail('Lançamento não encontrado');
    if (t.recurringId && d.finance.transactions.some((x) => x.id !== id && !x.deleted && x.recurringId === t.recurringId && x.occurrenceDate === t.occurrenceDate)) fail('Já existe outro lançamento para esta ocorrência.');
    if (t.debtInstallment) {
      const acc = d.finance.accounts.find((a) => a.id === t.debtInstallment!.debtAccountId);
      const inst = acc ? debtInstallments(d.finance, acc).find((x) => x.number === t.debtInstallment!.number) : undefined;
      if (inst?.paid) fail('Esta parcela já foi paga em outro lançamento.');
    }
    const { history, ...before } = t;
    t.deleted = false;
    t.deletedAt = undefined;
    t.history = [...(history ?? []), { at: Date.now(), action: 'restore', before }];
    audit(d, 'lancamento:restaurar', id);
  });
}

export function confirmPending(id: string) {
  update((d) => {
    const t = d.finance.transactions.find((x) => x.id === id) ?? fail('Lançamento não encontrado');
    if (t.date > todayISO()) fail('Este lançamento ainda é futuro. Mude a data para hoje se ele já aconteceu.');
    const { history, ...before } = t;
    t.status = 'confirmed';
    t.updatedAt = Date.now();
    t.history = [...(history ?? []), { at: Date.now(), action: 'edit', before }];
    audit(d, 'lancamento:confirmar', id);
    markActivity(d);
  });
}

/** Registrar economia: duas formas, explicadas na interface. */
export function registerSaving(opts: { amount: Cents; accountId: string; mode: 'new-money' | 'move'; fromAccountId?: string; description?: string; date?: ISODate }) {
  if (opts.mode === 'move') {
    return addTransaction({ kind: 'transfer', amount: opts.amount, accountId: opts.fromAccountId!, toAccountId: opts.accountId, date: opts.date ?? todayISO(), description: opts.description || 'Guardado na reserva' });
  }
  return addTransaction({ kind: 'income', saving: true, amount: opts.amount, accountId: opts.accountId, categoryId: 'cat-economia', date: opts.date ?? todayISO(), description: opts.description || 'Economia guardada' });
}

export function payDebtInstallment(debtAccountId: string, number: number, fromAccountId: string, date: ISODate, amount: Cents) {
  const s = getState();
  const acc = s.finance.accounts.find((a) => a.id === debtAccountId);
  if (!acc?.debt) fail('Dívida sem plano de parcelas.');
  const due = acc!.debt!.firstDueDate;
  const dueDate = monthAdd(due, number - 1);
  return addTransaction({
    kind: 'transfer', amount, accountId: fromAccountId, toAccountId: debtAccountId, date,
    description: `Parcela ${number}/${acc!.debt!.installmentsTotal} — ${acc!.name}`,
    debtInstallment: { debtAccountId, number, dueDate },
  });
}
function monthAdd(iso: ISODate, n: number) {
  const [y, m, dd] = iso.split('-').map(Number);
  const target = new Date(y, m - 1 + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(dd, last));
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
}

export function payCardInvoice(cardId: string, fromAccountId: string, amount: Cents, date: ISODate, invoiceMonth: string) {
  const s = getState();
  const card = s.finance.accounts.find((a) => a.id === cardId);
  return addTransaction({ kind: 'transfer', amount, accountId: fromAccountId, toAccountId: cardId, date, description: `Pagamento fatura ${card?.name ?? ''} ${invoiceMonth}` });
}

export function confirmOccurrence(ruleId: string, date: ISODate, overrides: { amount?: Cents; accountId?: string; date?: ISODate } = {}) {
  const s = getState();
  const r = s.finance.recurring.find((x) => x.id === ruleId) ?? fail('Recorrência não encontrada');
  const when = overrides.date ?? date;
  if (when > todayISO()) fail('Só é possível confirmar o que já aconteceu. Altere a data para hoje ou antes.');
  return addTransaction({
    kind: r.kind, amount: overrides.amount ?? r.amount, accountId: overrides.accountId ?? r.accountId, categoryId: r.categoryId,
    date: when, description: r.name, recurringId: r.id, occurrenceDate: date,
  });
}

/* ===================== RECORRÊNCIAS, METAS, ORÇAMENTO, CATEGORIAS ===================== */

export function saveRecurring(r: Omit<RecurringRule, 'id' | 'createdAt'> & { id?: string }) {
  assertCents(r.amount);
  if (r.amount <= 0) fail('Valor precisa ser positivo.');
  if (!r.name.trim()) fail('Dê um nome.');
  if (!isValidISODate(r.startDate)) fail('Data inicial inválida.');
  if (r.day < 1 || r.day > 31) fail('Dia inválido.');
  update((d) => {
    if (!d.finance.accounts.some((a) => a.id === r.accountId)) fail('Conta inválida.');
    if (r.id) {
      const ex = d.finance.recurring.find((x) => x.id === r.id) ?? fail('Não encontrada');
      Object.assign(ex, r);
      audit(d, 'recorrencia:editar', r.name);
    } else {
      d.finance.recurring.push({ ...r, id: uid('rec_'), createdAt: Date.now() });
      audit(d, 'recorrencia:criar', `${r.name} ${formatBRL(r.amount)}`);
    }
    markActivity(d);
  });
}
export function deleteRecurring(id: string) {
  update((d) => { d.finance.recurring = d.finance.recurring.filter((x) => x.id !== id); audit(d, 'recorrencia:excluir', id); });
}

export function saveGoal(g: Omit<Goal, 'id' | 'createdAt'> & { id?: string }) {
  assertCents(g.target);
  if (g.target <= 0) fail('Meta precisa ser maior que zero.');
  if (!g.name.trim()) fail('Dê um nome para a meta.');
  update((d) => {
    if (g.id) Object.assign(d.finance.goals.find((x) => x.id === g.id) ?? fail('Meta não encontrada'), g);
    else d.finance.goals.push({ ...g, id: uid('goal_'), createdAt: Date.now() });
    audit(d, 'meta:salvar', `${g.name} ${formatBRL(g.target)}`);
  });
}
export function deleteGoal(id: string) { update((d) => { d.finance.goals = d.finance.goals.filter((x) => x.id !== id); audit(d, 'meta:excluir', id); }); }

export function setBudget(b: Budget | { categoryId: string; limit: null }) {
  update((d) => {
    d.finance.budgets = d.finance.budgets.filter((x) => x.categoryId !== b.categoryId);
    if (b.limit != null) { assertCents(b.limit); if (b.limit > 0) d.finance.budgets.push(b as Budget); }
    audit(d, 'orcamento', `${b.categoryId}: ${b.limit == null ? 'removido' : formatBRL(b.limit)}`);
  });
}

export function saveCategory(c: Omit<Category, 'id'> & { id?: string }) {
  if (!c.name.trim()) fail('Nome vazio.');
  update((d) => {
    if (c.id) { const ex = d.finance.categories.find((x) => x.id === c.id) ?? fail('Categoria não encontrada'); ex.name = c.name; ex.color = c.color; ex.icon = c.icon; }
    else d.finance.categories.push({ ...c, id: uid('cat_'), system: false });
  });
}
export function deleteCategory(id: string) {
  update((d) => {
    const c = d.finance.categories.find((x) => x.id === id);
    if (c?.system) fail('Categorias padrão não podem ser excluídas.');
    d.finance.transactions.forEach((t) => { if (t.categoryId === id) t.categoryId = undefined; });
    d.finance.recurring.forEach((t) => { if (t.categoryId === id) t.categoryId = undefined; });
    d.finance.budgets = d.finance.budgets.filter((b) => b.categoryId !== id);
    d.finance.categories = d.finance.categories.filter((x) => x.id !== id);
  });
}

/* ===================== LOJA E INVENTÁRIO ===================== */

function coinsAvailable(s: SaveData) { return computeProgress(s).coins; }

export function buyItem(defId: string, opts: { place?: boolean } = {}): number {
  const s = getState();
  const def = getItem(defId) ?? fail('Item não existe');
  if (def.fixture || def.price <= 0) fail('Este item não está à venda.');
  const prog = computeProgress(s);
  if (def.minLevel && prog.level < def.minLevel) fail(`Requer nível ${def.minLevel}.`);
  if (def.event && !activeEvents().some((e) => e.id === def.event)) fail('Item de evento fora de temporada.');
  if (prog.coins < def.price) fail(`Moedas insuficientes: faltam ${def.price - prog.coins}.`);
  let newUid = 0;
  update((d) => {
    newUid = d.game.nextUid++;
    let placed: Placement | null = null;
    if (opts.place) {
      const spot = findFreeSpot(roomInfo(d), def);
      placed = spot;
    }
    d.game.inventory.push({ uid: newUid, defId, placed, acquiredAt: Date.now() });
    d.game.coinLedger.push({ id: uid('c_'), at: Date.now(), amount: -def.price, reason: `Compra: ${def.name}`, kind: 'buy', ref: String(newUid) });
  });
  return newUid;
}

export function toggleWish(defId: string) {
  update((d) => {
    const w = d.game.wishlist ?? (d.game.wishlist = []);
    const i = w.indexOf(defId);
    if (i >= 0) w.splice(i, 1); else { if (w.length >= 30) fail('A lista de desejos aceita até 30 itens.'); w.push(defId); }
  });
}

export function sellItem(itemUid: number) {
  update((d) => {
    const it = d.game.inventory.find((i) => i.uid === itemUid) ?? fail('Item não encontrado');
    if (it.locked || it.gift) fail('Este item veio com o imóvel e não pode ser vendido (só movido ou guardado).');
    const def = getItem(it.defId)!;
    // itens apoiados nesta mesa voltam para o inventário (não ficam flutuando)
    if (def.surface && it.placed) {
      const room = roomInfo(d, it.placed.propertyId);
      const me = room.placed.find((x) => x.item.uid === itemUid);
      if (me) for (const o of room.placed) {
        if (o.def.place === 'top' && o.z > 0 && o.p.x >= me.p.x && o.p.x < me.p.x + me.w && o.p.y >= me.p.y && o.p.y < me.p.y + me.d) {
          const oi = d.game.inventory.find((i) => i.uid === o.item.uid); if (oi) oi.placed = null;
        }
      }
    }
    d.game.inventory = d.game.inventory.filter((i) => i.uid !== itemUid);
    const value = sellPrice(def);
    d.game.coinLedger.push({ id: uid('c_'), at: Date.now(), amount: value, reason: `Venda: ${def.name}`, kind: 'sell', ref: String(itemUid) });
  });
}

export function placeItem(itemUid: number, p: Placement) {
  update((d) => {
    const it = d.game.inventory.find((i) => i.uid === itemUid) ?? fail('Item não encontrado');
    const def = getItem(it.defId)!;
    const room = roomInfo(d, p.propertyId);
    const chk = checkPlacement(room, def, p, itemUid);
    if (!chk.ok) fail(chk.reason ?? 'Posição inválida');
    const old = it.placed;
    // itens sobre uma mesa acompanham a mesa quando ela é movida
    const riders: number[] = [];
    if (def.surface && old && old.propertyId === p.propertyId) {
      const me = room.placed.find((x) => x.item.uid === itemUid);
      if (me) for (const o of room.placed) {
        if (o.def.place === 'top' && o.z > 0 && o.p.x >= me.p.x && o.p.x < me.p.x + me.w && o.p.y >= me.p.y && o.p.y < me.p.y + me.d) riders.push(o.item.uid);
      }
    }
    it.placed = { propertyId: p.propertyId, x: p.x, y: p.y, rot: p.rot };
    for (const r of riders) {
      const ri = d.game.inventory.find((i) => i.uid === r)!;
      if (old!.rot !== p.rot) { ri.placed = null; continue; }
      ri.placed = { ...ri.placed!, x: ri.placed!.x + (p.x - old!.x), y: ri.placed!.y + (p.y - old!.y) };
    }
  });
}

export function storeItem(itemUid: number) {
  update((d) => {
    const it = d.game.inventory.find((i) => i.uid === itemUid) ?? fail('Item não encontrado');
    if (it.locked) fail('Este item é fixo do imóvel.');
    const def = getItem(it.defId)!;
    // ao guardar uma mesa, os itens em cima vão para o inventário também
    if (def.surface && it.placed) {
      const p = it.placed;
      const room = roomInfo(d, p.propertyId);
      const me = room.placed.find((x) => x.item.uid === itemUid)!;
      for (const o of room.placed) {
        if (o.def.place === 'top' && o.z > 0 && o.p.x >= me.p.x && o.p.x < me.p.x + me.w && o.p.y >= me.p.y && o.p.y < me.p.y + me.d) {
          const oi = d.game.inventory.find((i) => i.uid === o.item.uid); if (oi) oi.placed = null;
        }
      }
    }
    it.placed = null;
  });
}

export function storeAll(propertyId: string) {
  update((d) => { d.game.inventory.forEach((i) => { if (i.placed?.propertyId === propertyId && !i.locked) i.placed = null; }); });
}

export function buyStyle(styleId: string) {
  const s = getState();
  const st = getStyle(styleId) ?? fail('Estilo não existe');
  if (s.game.ownedStyles.includes(styleId)) return applyStyle(styleId);
  const prog = computeProgress(s);
  if (st.minLevel && prog.level < st.minLevel) fail(`Requer nível ${st.minLevel}.`);
  if (prog.coins < st.price) fail(`Moedas insuficientes: faltam ${st.price - prog.coins}.`);
  update((d) => {
    d.game.ownedStyles.push(styleId);
    d.game.coinLedger.push({ id: uid('c_'), at: Date.now(), amount: -st.price, reason: `Reforma: ${st.name}`, kind: 'style', ref: styleId });
    const room = d.game.rooms[d.game.currentProperty];
    if (st.kind === 'floor') room.floor = styleId; else room.wall = styleId;
  });
}
export function applyStyle(styleId: string) {
  update((d) => {
    const st = getStyle(styleId) ?? fail('Estilo não existe');
    if (!d.game.ownedStyles.includes(styleId)) fail('Você ainda não tem este estilo.');
    const room = d.game.rooms[d.game.currentProperty];
    if (st.kind === 'floor') room.floor = styleId; else room.wall = styleId;
  });
}
export function setLightTheme(theme: string) { update((d) => { d.game.rooms[d.game.currentProperty].light = theme; }); }

/* ===================== IMÓVEIS ===================== */

export function buyProperty(propertyId: string) {
  const s = getState();
  const p = getProperty(propertyId) ?? fail('Imóvel não existe');
  if (s.game.ownedProperties.includes(propertyId)) return switchProperty(propertyId);
  const prog = computeProgress(s);
  if (prog.level < p.req.level) fail(`Requer nível ${p.req.level}.`);
  if (prog.metrics.peakGain < p.req.gainCents) fail(`Requer ${formatBRL(p.req.gainCents)} de economia acumulada.`);
  const prev = PROPERTIES.find((x) => x.order === p.order - 1);
  if (prev && !s.game.ownedProperties.includes(prev.id)) fail(`Desbloqueie antes: ${prev.name}.`);
  if (prog.coins < p.price) fail(`Moedas insuficientes: faltam ${p.price - prog.coins}.`);
  update((d) => {
    d.game.ownedProperties.push(propertyId);
    d.game.rooms[propertyId] = roomDefaults(propertyId);
    d.game.ownedStyles.push(p.floor, p.wall);
    d.game.ownedStyles = [...new Set(d.game.ownedStyles)];
    const items = starterItems(propertyId, d.game.nextUid);
    d.game.nextUid += items.length;
    d.game.inventory.push(...items);
    d.game.coinLedger.push({ id: uid('c_'), at: Date.now(), amount: -p.price, reason: `Imóvel: ${p.name}`, kind: 'property', ref: propertyId });
    d.game.currentProperty = propertyId;
  });
}
export function switchProperty(propertyId: string) {
  update((d) => { if (!d.game.ownedProperties.includes(propertyId)) fail('Imóvel não é seu ainda.'); d.game.currentProperty = propertyId; });
}
export function buyExpansion() {
  const s = getState();
  const pid = s.game.currentProperty;
  const p = getProperty(pid);
  const room = s.game.rooms[pid];
  if (room.expansion >= p.maxExpansion) fail('Este imóvel já está no tamanho máximo.');
  const price = expansionPrice(p, room.expansion + 1);
  if (coinsAvailable(s) < price) fail(`Moedas insuficientes: faltam ${price - coinsAvailable(s)}.`);
  update((d) => {
    d.game.rooms[pid].expansion++;
    d.game.coinLedger.push({ id: uid('c_'), at: Date.now(), amount: -price, reason: `Expansão: ${p.name}`, kind: 'expansion', ref: pid });
  });
}

/* ===================== LAYOUTS ===================== */

export function saveLayout(name: string) {
  update((d) => {
    const pid = d.game.currentProperty;
    const room = d.game.rooms[pid];
    room.layouts.push({
      id: uid('lay_'), name: name.trim() || `Layout ${room.layouts.length + 1}`, createdAt: Date.now(), floor: room.floor, wall: room.wall,
      items: d.game.inventory.filter((i) => i.placed?.propertyId === pid && !i.locked).map((i) => ({ defId: i.defId, x: i.placed!.x, y: i.placed!.y, rot: i.placed!.rot })),
    });
  });
}
export function deleteLayout(id: string) { update((d) => { const r = d.game.rooms[d.game.currentProperty]; r.layouts = r.layouts.filter((l) => l.id !== id); }); }
/** Aplica um layout: guarda tudo e recoloca o que houver no inventário. Retorna quantos itens faltaram. */
export function loadLayout(id: string): number {
  let missing = 0;
  update((d) => {
    const pid = d.game.currentProperty;
    const room = d.game.rooms[pid];
    const lay = room.layouts.find((l) => l.id === id) ?? fail('Layout não encontrado');
    d.game.inventory.forEach((i) => { if (i.placed?.propertyId === pid && !i.locked) i.placed = null; });
    if (d.game.ownedStyles.includes(lay.floor)) room.floor = lay.floor;
    if (d.game.ownedStyles.includes(lay.wall)) room.wall = lay.wall;
    // primeiro chão, depois itens de mesa
    const order = [...lay.items].sort((a, b) => (getItem(a.defId)?.place === 'top' ? 1 : 0) - (getItem(b.defId)?.place === 'top' ? 1 : 0));
    for (const li of order) {
      const free = d.game.inventory.find((i) => i.defId === li.defId && !i.placed);
      const def = getItem(li.defId);
      if (!free || !def) { missing++; continue; }
      const p = { propertyId: pid, x: li.x, y: li.y, rot: li.rot };
      if (checkPlacement(roomInfo(d, pid), def, p, free.uid).ok) free.placed = p; else missing++;
    }
  });
  return missing;
}

/* ===================== PERFIL / VISUAL / MISSÕES ===================== */

export function setAvatar(a: AvatarConfig) {
  const s = getState();
  const prem = PREMIUM_ACCESSORIES[a.accessory];
  if (prem && !s.game.ownedCosmetics.includes(`acc-${a.accessory}`)) fail('Compre este acessório primeiro.');
  update((d) => { d.profile.avatar = { ...a }; d.game.visits['avatar-saved'] = (d.game.visits['avatar-saved'] ?? 0) + 1; });
}
export function buyCosmetic(accessory: number) {
  const s = getState();
  const prem = PREMIUM_ACCESSORIES[accessory] ?? fail('Acessório gratuito.');
  const prog = computeProgress(s);
  if (prog.level < prem.minLevel) fail(`Requer nível ${prem.minLevel}.`);
  if (prog.coins < prem.price) fail(`Moedas insuficientes: faltam ${prem.price - prog.coins}.`);
  update((d) => {
    d.game.ownedCosmetics.push(`acc-${accessory}`);
    d.game.coinLedger.push({ id: uid('c_'), at: Date.now(), amount: -prem.price, reason: `Visual: acessório ${accessory}`, kind: 'cosmetic', ref: String(accessory) });
  });
}
export function setProfile(p: { name?: string; titleId?: string | null; onboarded?: boolean; onboardingStep?: number }) {
  update((d) => { Object.assign(d.profile, p); });
}
export function setSettings(p: Partial<Settings>) { update((d) => { Object.assign(d.settings, p); }); }

export function claim(key: string, coins: number, xp: number, label: string) {
  update((d) => {
    if (d.game.claims[key]) fail('Recompensa já resgatada.');
    d.game.claims[key] = { at: Date.now(), coins, xp, label };
  });
}

export function visit(screen: string) {
  const s = getState();
  const k = `${screen}:${todayISO()}`;
  if (s.game.visits[k] && s.game.visits[screen]) return;
  update((d) => { d.game.visits[screen] = (d.game.visits[screen] ?? 0) + 1; d.game.visits[k] = 1; });
}

export function markSeen(achIds: string[], level?: number) {
  update((d) => {
    for (const id of achIds) if (!d.game.seenAchievements[id]) d.game.seenAchievements[id] = Date.now();
    if (level && level > d.game.seenLevel) d.game.seenLevel = level;
  });
}

export { addMonthKey, monthKey };
