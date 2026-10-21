import type { Cents } from '../core/money';
import { addDays, diffDays, monthKey, todayISO, weekKey } from '../core/dates';
import {
  activeTx, balancesAt, calendarEvents, debtInstallments, goalProgress, isMonthComplete, monthEndISO, monthSummary,
  netWorthEffect, sortTx, totals, txEffects,
} from '../finance/ledger';
import type { SaveData } from '../state/types';
import { isLiability } from '../state/types';

/**
 * ============ ECONOMIA VIRTUAL ============
 * COINS e XP são DERIVADOS do histórico financeiro, nunca acumulados "por evento".
 * Isso garante que:
 *  - editar/excluir/recriar lançamentos não duplica moedas (o valor é sempre recalculado);
 *  - transferências entre contas não geram nada (não mudam o patrimônio);
 *  - empréstimos não contam como enriquecimento (ativo e passivo sobem juntos);
 *  - saldo inicial é linha de base e não gera recompensa;
 *  - gastar dinheiro real depois não retira moedas já conquistadas (usa o PICO histórico),
 *    mas apagar um lançamento falso retira, pois o pico é recalculado sem ele.
 */

export interface Metrics {
  /** Pico de ganho de patrimônio desde o início (centavos). Base das moedas de economia. */
  peakGain: Cents;
  currentGain: Cents;
  netWorth: Cents;
  peakNetWorth: Cents;
  baselineNetWorth: Cents;
  /** Redução de dívidas pré-existentes (valor inicial devido - menor valor devido atingido) */
  debtReduction: Cents;
  debtsPaidOff: number;
  installmentsPaid: number;
  installmentsPrepaid: number;
  txCount: number;
  incomeCount: number;
  expenseCount: number;
  accountsCount: number;
  customCategories: number;
  recurringCount: number;
  goalsCreated: number;
  goalsCompleted: number;
  reservePeak: Cents;
  guardedPeak: Cents; // pico em contas de poupança/reserva/investimento
  positiveMonths: number;
  bestPositiveStreak: number;
  budgetMonths: number;
  billsMonths: number;
  bestMonthResult: Cents;
  lowerExpenseMonths: number;
  activityDays: number;
  bestStreak: number;
  currentStreak: number;
  activeWeeks: number;
  /** jogo */
  itemsBought: number;
  distinctItems: number;
  itemsPlaced: number;
  propertiesOwned: number;
  expansions: number;
  cosmeticsBought: number;
  coinsEarnedBase: number;
  visits: Record<string, number>;
  avatarCustomized: boolean;
  layoutsSaved: number;
  stylesBought: number;
}

const r = (c: Cents) => c / 100;

/** Curva de moedas por R$ economizado: generosa no começo, decrescente depois. */
export function savingsCoins(gainCents: Cents): number {
  const reais = Math.max(0, r(gainCents));
  const tiers: [number, number][] = [[100, 2], [1000, 1], [10000, 0.4], [100000, 0.1], [Infinity, 0.03]];
  let rest = reais, prev = 0, coins = 0;
  for (const [cap, rate] of tiers) {
    const span = Math.min(rest, cap - prev);
    if (span <= 0) break;
    coins += span * rate;
    rest -= span;
    prev = cap;
  }
  return Math.floor(coins);
}

/** Quitar dívida antiga rende um pouco mais por real. */
export function debtCoins(reductionCents: Cents): number {
  return Math.floor(savingsCoins(reductionCents) * 1.25);
}

export const COINS_PER_ACTIVE_DAY = 5;
export const XP_PER_ACTIVE_DAY = 10;

export function computeMetrics(save: SaveData, today = todayISO()): Metrics {
  const fin = save.finance;
  const txs = fin.transactions.filter((t) => activeTx(t) && t.date <= today).sort(sortTx);
  const accById = new Map(fin.accounts.map((a) => [a.id, a]));

  // linha de base: saldos iniciais (contas abertas até hoje)
  let baseline = 0;
  const bal = new Map<string, Cents>();
  const minOwed = new Map<string, Cents>();
  const peakBal = new Map<string, Cents>();
  for (const a of fin.accounts) {
    const v = a.openedAt <= today ? a.initialBalance : 0;
    baseline += v;
    bal.set(a.id, v);
    if (isLiability(a.type)) minOwed.set(a.id, -v);
    peakBal.set(a.id, v);
  }

  let gain = 0, peakGain = 0;
  let guarded = 0, guardedPeak = 0;
  const guardedTypes = new Set(['savings', 'reserve', 'investment']);
  for (const a of fin.accounts) if (guardedTypes.has(a.type)) guarded += bal.get(a.id) ?? 0;
  guardedPeak = Math.max(0, guarded);
  let reserve = 0;
  for (const a of fin.accounts) if (a.type === 'reserve') reserve += bal.get(a.id) ?? 0;
  let reservePeak = Math.max(0, reserve);
  let nw = baseline, peakNW = baseline;

  for (const t of txs) {
    let eff = netWorthEffect(t);
    // ajustes positivos são correções de saldo: contam no patrimônio mas não geram recompensa
    const rewardEff = t.kind === 'adjustment' && eff > 0 ? 0 : eff;
    gain += rewardEff;
    nw += eff;
    if (gain > peakGain) peakGain = gain;
    if (nw > peakNW) peakNW = nw;
    for (const e of txEffects(t)) {
      const a = accById.get(e.accountId);
      if (!a) continue;
      const nb = (bal.get(a.id) ?? 0) + e.delta;
      bal.set(a.id, nb);
      if (nb > (peakBal.get(a.id) ?? 0)) peakBal.set(a.id, nb);
      if (isLiability(a.type)) minOwed.set(a.id, Math.min(minOwed.get(a.id) ?? 0, -nb));
      if (guardedTypes.has(a.type)) guarded += e.delta;
      if (a.type === 'reserve') reserve += e.delta;
    }
    guardedPeak = Math.max(guardedPeak, guarded);
    reservePeak = Math.max(reservePeak, reserve);
  }

  let debtReduction = 0, debtsPaidOff = 0;
  for (const a of fin.accounts) {
    if (!isLiability(a.type) || a.openedAt > today) continue;
    const initialOwed = -a.initialBalance;
    if (initialOwed <= 0) continue;
    const mo = Math.max(0, minOwed.get(a.id) ?? initialOwed);
    debtReduction += Math.max(0, initialOwed - mo);
    if (mo <= 0) debtsPaidOff++;
  }

  let installmentsPaid = 0, installmentsPrepaid = 0;
  for (const t of txs) {
    if (t.debtInstallment) {
      installmentsPaid++;
      if (t.date < t.debtInstallment.dueDate) installmentsPrepaid++;
    }
  }

  // meses completos
  const months = new Set(txs.map((t) => monthKey(t.date)));
  const sortedMonths = [...months].sort();
  let positiveMonths = 0, streak = 0, bestPositiveStreak = 0, budgetMonths = 0, billsMonths = 0, bestMonthResult = 0, lowerExpenseMonths = 0;
  let prevExpense: number | null = null;
  for (const m of sortedMonths) {
    if (!isMonthComplete(m, today)) continue;
    const s = monthSummary(fin, m);
    if (s.result > 0 && s.count > 0) { positiveMonths++; streak++; bestPositiveStreak = Math.max(bestPositiveStreak, streak); } else streak = 0;
    bestMonthResult = Math.max(bestMonthResult, s.result);
    if (prevExpense != null && s.expense > 0 && s.expense < prevExpense) lowerExpenseMonths++;
    if (s.expense > 0) prevExpense = s.expense;
    if (fin.budgets.length > 0 && s.count > 0 && fin.budgets.every((b) => (s.byCategory.get(b.categoryId) ?? 0) <= b.limit)) budgetMonths++;
    const ev = calendarEvents(fin, `${m}-01`, monthEndISO(m)).filter((e) => (e.kind === 'recurring' && e.amount < 0) || e.kind === 'debt');
    if (ev.length > 0 && ev.every((e) => e.done)) billsMonths++;
  }

  // metas
  let goalsCompleted = 0;
  for (const g of fin.goals) {
    const peak = g.accountId ? peakBal.get(g.accountId) ?? 0 : peakNW;
    if (g.target > 0 && Math.max(peak, goalProgress(fin, g)) >= g.target) goalsCompleted++;
  }

  // constância (relógio real)
  const days = [...new Set(save.game.activityDays)].sort();
  let bestStreak = 0, cur = 0, prev: string | null = null;
  for (const d of days) {
    // tolerância: até 1 dia sem registro não quebra a sequência (sem punição exagerada)
    if (prev && diffDays(prev, d) <= 2) cur++; else cur = 1;
    bestStreak = Math.max(bestStreak, cur);
    prev = d;
  }
  const last = days[days.length - 1];
  const currentStreak = last && diffDays(last, today) <= 2 ? cur : 0;
  const activeWeeks = new Set(days.map(weekKey)).size;

  // jogo
  const inv = save.game.inventory;
  const bought = save.game.coinLedger.filter((e) => e.kind === 'buy');
  // só contam itens comprados (os móveis que vêm com o imóvel não valem conquista)
  const boughtUids = new Set(bought.map((e) => e.ref ?? ''));
  const coinsEarnedBase = savingsCoins(peakGain) + debtCoins(debtReduction) + days.length * COINS_PER_ACTIVE_DAY;

  return {
    peakGain, currentGain: gain, netWorth: nw, peakNetWorth: peakNW, baselineNetWorth: baseline,
    debtReduction, debtsPaidOff, installmentsPaid, installmentsPrepaid,
    txCount: txs.length, incomeCount: txs.filter((t) => t.kind === 'income').length, expenseCount: txs.filter((t) => t.kind === 'expense').length,
    accountsCount: fin.accounts.filter((a) => !a.archived).length,
    customCategories: fin.categories.filter((c) => !c.system).length,
    recurringCount: fin.recurring.length,
    goalsCreated: fin.goals.length, goalsCompleted, reservePeak, guardedPeak,
    positiveMonths, bestPositiveStreak, budgetMonths, billsMonths, bestMonthResult, lowerExpenseMonths,
    activityDays: days.length, bestStreak, currentStreak, activeWeeks,
    itemsBought: bought.length,
    distinctItems: new Set(inv.filter((i) => boughtUids.has(String(i.uid))).map((i) => i.defId)).size,
    itemsPlaced: inv.filter((i) => boughtUids.has(String(i.uid)) && i.placed && i.placed.propertyId === save.game.currentProperty).length,
    propertiesOwned: save.game.ownedProperties.length,
    expansions: Object.values(save.game.rooms).reduce((a, r) => a + r.expansion, 0),
    cosmeticsBought: save.game.ownedCosmetics.length,
    coinsEarnedBase,
    visits: save.game.visits,
    avatarCustomized: (save.game.visits['avatar-saved'] ?? 0) > 0,
    layoutsSaved: Object.values(save.game.rooms).reduce((a, r) => a + r.layouts.length, 0),
    stylesBought: save.game.coinLedger.filter((e) => e.kind === 'style').length,
  };
}

/* ============ NÍVEIS ============ */

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(40 * Math.pow(level - 1, 1.7));
}

export function levelFromXp(xp: number): { level: number; cur: number; next: number; into: number; span: number } {
  let level = 1;
  while (level < 200 && xp >= xpForLevel(level + 1)) level++;
  const cur = xpForLevel(level), next = xpForLevel(level + 1);
  return { level, cur, next, into: xp - cur, span: next - cur };
}

export { addDays, balancesAt, totals, debtInstallments };
