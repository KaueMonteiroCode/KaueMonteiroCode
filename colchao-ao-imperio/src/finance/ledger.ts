import type { Cents } from '../core/money';
import {
  addDays, addMonthKey, addMonths, daysInMonth, fromISO, monthKey, todayISO, toISO, type ISODate,
} from '../core/dates';
import type { Account, FinanceState, RecurringRule, Transaction } from '../state/types';
import { isLiability } from '../state/types';

/**
 * Modelo contábil: todo saldo é ASSINADO.
 *  - Ativos (conta, poupança, dinheiro, investimento, reserva): positivo = dinheiro seu.
 *  - Passivos (cartão, dívida): negativo = valor devido.
 * Patrimônio líquido = soma de todos os saldos.
 * Assim, transferências (inclusive pagar fatura, pagar dívida ou receber empréstimo)
 * nunca alteram o patrimônio — só receitas, despesas e ajustes alteram.
 */

export const activeTx = (t: Transaction) => !t.deleted && t.status === 'confirmed';

export function txEffects(t: Transaction): { accountId: string; delta: Cents }[] {
  switch (t.kind) {
    case 'income':
      return [{ accountId: t.accountId, delta: t.amount }];
    case 'expense':
      return [{ accountId: t.accountId, delta: -t.amount }];
    case 'transfer':
      return t.toAccountId
        ? [{ accountId: t.accountId, delta: -t.amount }, { accountId: t.toAccountId, delta: t.amount }]
        : [];
    case 'adjustment':
      return [{ accountId: t.accountId, delta: t.amount }];
  }
}

/** Efeito de um lançamento no patrimônio líquido. Transferências = 0. */
export function netWorthEffect(t: Transaction): Cents {
  switch (t.kind) {
    case 'income': return t.amount;
    case 'expense': return -t.amount;
    case 'transfer': return 0;
    case 'adjustment': return t.amount;
  }
}

export function sortTx(a: Transaction, b: Transaction) {
  return a.date < b.date ? -1 : a.date > b.date ? 1 : a.createdAt - b.createdAt;
}

export function balancesAt(fin: FinanceState, asOf: ISODate = todayISO()): Map<string, Cents> {
  const m = new Map<string, Cents>();
  for (const a of fin.accounts) m.set(a.id, a.openedAt <= asOf ? a.initialBalance : 0);
  for (const t of fin.transactions) {
    if (!activeTx(t) || t.date > asOf) continue;
    for (const e of txEffects(t)) if (m.has(e.accountId)) m.set(e.accountId, m.get(e.accountId)! + e.delta);
  }
  return m;
}

export interface Totals {
  assets: Cents;
  liabilities: Cents; // positivo = quanto deve
  netWorth: Cents;
  liquid: Cents; // contas correntes, dinheiro, poupança
}

export function totals(fin: FinanceState, asOf: ISODate = todayISO()): Totals {
  const b = balancesAt(fin, asOf);
  let assets = 0, liabilities = 0, liquid = 0;
  for (const a of fin.accounts) {
    const v = b.get(a.id) ?? 0;
    if (isLiability(a.type)) liabilities += -v;
    else {
      assets += v;
      if (a.type === 'checking' || a.type === 'cash' || a.type === 'savings') liquid += v;
    }
  }
  return { assets, liabilities, netWorth: assets - liabilities, liquid };
}

export interface MonthSummary {
  month: string;
  income: Cents; // receitas (sem economias declaradas)
  saved: Cents; // economias declaradas
  expense: Cents;
  result: Cents; // receitas + economias - despesas
  byCategory: Map<string, Cents>;
  incomeByCategory: Map<string, Cents>;
  count: number;
}

export function monthSummary(fin: FinanceState, month: string): MonthSummary {
  const s: MonthSummary = { month, income: 0, saved: 0, expense: 0, result: 0, byCategory: new Map(), incomeByCategory: new Map(), count: 0 };
  for (const t of fin.transactions) {
    if (!activeTx(t) || monthKey(t.date) !== month) continue;
    s.count++;
    const cat = t.categoryId ?? 'sem-categoria';
    if (t.kind === 'income' && t.saving) {
      s.saved += t.amount;
    } else if (t.kind === 'income') {
      s.income += t.amount;
      s.incomeByCategory.set(cat, (s.incomeByCategory.get(cat) ?? 0) + t.amount);
    } else if (t.kind === 'expense') {
      s.expense += t.amount;
      s.byCategory.set(cat, (s.byCategory.get(cat) ?? 0) + t.amount);
    }
  }
  s.result = s.income + s.saved - s.expense;
  return s;
}

export function lastMonths(n: number, from: string = monthKey(todayISO())): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addMonthKey(from, -i));
  return out;
}

export function netWorthSeries(fin: FinanceState, months: string[]): { month: string; netWorth: Cents }[] {
  const today = todayISO();
  return months.map((m) => {
    const end = `${m}-${String(daysInMonth(m)).padStart(2, '0')}`;
    return { month: m, netWorth: totals(fin, end < today ? end : today).netWorth };
  });
}

/* ---------- Recorrências ---------- */

export function occurrences(rule: RecurringRule, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  const start = rule.startDate;
  const end = rule.endDate && rule.endDate < to ? rule.endDate : to;
  if (end < start) return out;
  if (rule.frequency === 'weekly') {
    let d = start;
    // dia da semana (1 = segunda … 7 = domingo); valores antigos fora disso usam a data inicial
    if (rule.day >= 1 && rule.day <= 7) {
      const dow = ((fromISO(start).getDay() + 6) % 7) + 1;
      d = addDays(start, (rule.day - dow + 7) % 7);
    }
    while (d <= end) {
      if (d >= from) out.push(d);
      d = addDays(d, 7);
    }
    return out;
  }
  const step = rule.frequency === 'yearly' ? 12 : 1;
  let d = addMonths(start.slice(0, 8) + '01', 0, rule.day);
  if (d < start) d = addMonths(d, step, rule.day);
  let guard = 0;
  while (d <= end && guard++ < 1000) {
    if (d >= from) out.push(d);
    d = addMonths(d, step, rule.day);
  }
  return out;
}

export function isOccurrenceConfirmed(fin: FinanceState, ruleId: string, date: ISODate) {
  return fin.transactions.some((t) => !t.deleted && t.recurringId === ruleId && t.occurrenceDate === date);
}

/* ---------- Dívidas ---------- */

export interface DebtInstallment {
  debtAccountId: string;
  number: number;
  dueDate: ISODate;
  amount: Cents;
  paidAmount: Cents;
  remaining: Cents;
  paid: boolean;
  paidOn?: ISODate;
  paidTx?: Transaction;
}

export function debtInstallments(fin: FinanceState, acc: Account): DebtInstallment[] {
  if (!acc.debt) return [];
  const p = acc.debt;
  const out: DebtInstallment[] = [];
  for (let i = 1; i <= p.installmentsTotal; i++) {
    const due = addMonths(p.firstDueDate, i - 1);
    const pays = fin.transactions.filter(
      (t) => !t.deleted && t.status === 'confirmed' && t.debtInstallment?.debtAccountId === acc.id && t.debtInstallment.number === i,
    ).sort(sortTx);
    // parcela só fica paga quando a soma dos pagamentos cobre o valor dela
    let sum = 0, paidOn: ISODate | undefined;
    for (const t of pays) { sum += t.amount; if (!paidOn && sum >= p.installmentAmount) paidOn = t.date; }
    out.push({ debtAccountId: acc.id, number: i, dueDate: due, amount: p.installmentAmount, paidAmount: sum, remaining: Math.max(0, p.installmentAmount - sum), paid: sum >= p.installmentAmount, paidOn, paidTx: pays[0] });
  }
  return out;
}

/* ---------- Cartão de crédito ---------- */

/** Mês da fatura em que um gasto no cartão cai. */
export function invoiceMonthFor(acc: Account, date: ISODate): string {
  const closing = acc.closingDay ?? 31;
  const day = Number(date.slice(8, 10));
  const mk = monthKey(date);
  return day > closing ? addMonthKey(mk, 1) : mk;
}

/** Valor de cada fatura (por mês) a partir das compras do cartão. Pagamentos não são descontados aqui. */
export function cardInvoices(fin: FinanceState, acc: Account): Map<string, Cents> {
  const m = new Map<string, Cents>();
  for (const t of fin.transactions) {
    if (!activeTx(t) || t.accountId !== acc.id || t.kind !== 'expense') continue;
    if (t.installments) {
      t.installments.amounts.forEach((v, i) => {
        const k = addMonthKey(t.installments!.firstInvoice, i);
        m.set(k, (m.get(k) ?? 0) + v);
      });
    } else {
      const k = invoiceMonthFor(acc, t.date);
      m.set(k, (m.get(k) ?? 0) + t.amount);
    }
  }
  return m;
}

/**
 * Situação de cada fatura: os pagamentos ao cartão (transferências para ele) quitam primeiro
 * o saldo que já existia ao cadastrar e depois as faturas mais antigas.
 */
export function cardInvoiceStatus(fin: FinanceState, acc: Account): Map<string, { amount: Cents; remaining: Cents; paid: boolean }> {
  const inv = [...cardInvoices(fin, acc).entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  let pool = 0;
  for (const t of fin.transactions) if (activeTx(t) && t.kind === 'transfer' && t.toAccountId === acc.id) pool += t.amount;
  pool -= Math.max(0, -acc.initialBalance); // dívida anterior ao cadastro é paga primeiro
  const out = new Map<string, { amount: Cents; remaining: Cents; paid: boolean }>();
  for (const [mk, v] of inv) {
    const used = Math.max(0, Math.min(v, pool));
    pool -= used;
    out.set(mk, { amount: v, remaining: v - used, paid: v - used <= 0 });
  }
  return out;
}

/* ---------- Calendário ---------- */

export interface CalendarEvent {
  date: ISODate;
  kind: 'recurring' | 'debt' | 'invoice' | 'pending' | 'tx';
  label: string;
  amount: Cents; // positivo = entra, negativo = sai
  done: boolean;
  ref: string;
  ruleId?: string;
  debt?: DebtInstallment;
}

export function calendarEvents(fin: FinanceState, from: ISODate, to: ISODate): CalendarEvent[] {
  const ev: CalendarEvent[] = [];
  for (const r of fin.recurring) {
    if (!r.active) continue;
    for (const d of occurrences(r, from, to)) {
      ev.push({
        date: d, kind: 'recurring', label: r.name, amount: r.kind === 'income' ? r.amount : -r.amount,
        done: isOccurrenceConfirmed(fin, r.id, d), ref: `${r.id}@${d}`, ruleId: r.id,
      });
    }
  }
  for (const a of fin.accounts) {
    if (a.archived) continue;
    if (a.type === 'debt' && a.debt) {
      for (const inst of debtInstallments(fin, a)) {
        if (inst.dueDate < from || inst.dueDate > to) continue;
        ev.push({
          date: inst.dueDate, kind: 'debt', label: `${a.name} — parcela ${inst.number}/${a.debt.installmentsTotal}${!inst.paid && inst.paidAmount > 0 ? ' (parcial)' : ''}`,
          amount: -(inst.paid ? inst.amount : inst.remaining), done: inst.paid, ref: `${a.id}#${inst.number}`, debt: inst,
        });
      }
    }
    if (a.type === 'credit_card') {
      const inv = cardInvoiceStatus(fin, a);
      for (const [mk, st] of inv) {
        const due = `${mk}-${String(Math.min(a.dueDay ?? 10, daysInMonth(mk))).padStart(2, '0')}`;
        if (due < from || due > to) continue;
        ev.push({ date: due, kind: 'invoice', label: `Fatura ${a.name}`, amount: -(st.paid ? st.amount : st.remaining), done: st.paid, ref: `${a.id}:${mk}` });
      }
    }
  }
  for (const t of fin.transactions) {
    if (t.deleted || t.date < from || t.date > to) continue;
    if (t.status === 'pending') {
      ev.push({ date: t.date, kind: 'pending', label: t.description || 'Lançamento pendente', amount: netWorthEffect(t), done: false, ref: t.id });
    }
  }
  return ev.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/* ---------- Projeção ---------- */

export interface ProjectionPoint { month: string; liquid: Cents; income: Cents; expense: Cents }

/**
 * Projeção simples de saldo disponível (contas líquidas) para os próximos meses:
 * saldo atual + recorrências futuras - parcelas de dívidas não pagas - faturas futuras.
 * É uma SIMULAÇÃO e é apresentada como tal.
 */
export function projection(fin: FinanceState, monthsAhead = 6): ProjectionPoint[] {
  const today = todayISO();
  let liquid = totals(fin, today).liquid;
  const out: ProjectionPoint[] = [];
  const start = monthKey(today);
  const cardDeferred = new Map<string, Cents>();
  for (let i = 0; i <= monthsAhead; i++) {
    const mk = addMonthKey(start, i);
    const from = i === 0 ? addDays(today, 1) : `${mk}-01`;
    const to = `${mk}-${String(daysInMonth(mk)).padStart(2, '0')}`;
    let inc = 0, exp = 0;
    if (from <= to) {
      for (const e of calendarEvents(fin, from, to)) {
        if (e.done) continue;
        // recorrência cobrada no cartão: não sai do saldo agora, entra na fatura (somada abaixo)
        const rule = e.ruleId ? fin.recurring.find((r) => r.id === e.ruleId) : undefined;
        const card = rule ? fin.accounts.find((a) => a.id === rule.accountId && a.type === 'credit_card') : undefined;
        if (card && e.amount < 0) {
          const im = invoiceMonthFor(card, e.date);
          cardDeferred.set(im, (cardDeferred.get(im) ?? 0) - e.amount);
          continue;
        }
        if (e.amount >= 0) inc += e.amount; else exp += -e.amount;
      }
    }
    exp += cardDeferred.get(mk) ?? 0;
    cardDeferred.delete(mk);
    liquid += inc - exp;
    out.push({ month: mk, liquid, income: inc, expense: exp });
  }
  return out;
}

/* ---------- Utilidades ---------- */

export function accountName(fin: FinanceState, id?: string) {
  return fin.accounts.find((a) => a.id === id)?.name ?? '—';
}

export function averageMonthlyExpense(fin: FinanceState, months = 3): Cents {
  const ms = lastMonths(months + 1).slice(0, -1);
  const vals = ms.map((m) => monthSummary(fin, m).expense).filter((v) => v > 0);
  if (!vals.length) return monthSummary(fin, monthKey(todayISO())).expense;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function goalProgress(fin: FinanceState, goal: { accountId?: string }): Cents {
  if (goal.accountId) return balancesAt(fin).get(goal.accountId) ?? 0;
  return totals(fin).netWorth;
}

export function monthEndISO(mk: string) {
  return `${mk}-${String(daysInMonth(mk)).padStart(2, '0')}`;
}

export function isMonthComplete(mk: string, today = todayISO()) {
  return monthEndISO(mk) < today;
}

export { fromISO, toISO };
