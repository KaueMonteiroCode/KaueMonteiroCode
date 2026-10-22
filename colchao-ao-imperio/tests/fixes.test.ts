import { describe, expect, it, beforeEach } from 'vitest';
import { addDays, todayISO } from '../src/core/dates';
import { newSave, normalizeSave } from '../src/state/defaults';
import { getState, setState } from '../src/state/store';
import * as A from '../src/state/actions';
import { computeProgress } from '../src/game/progress';
import { calendarEvents, debtInstallments, occurrences, projection, totals } from '../src/finance/ledger';
import { roomInfo } from '../src/game/room';
import { currentMissions } from '../src/game/missions';

const t = todayISO();
beforeEach(() => setState(newSave(), false));

describe('correções', () => {
  it('trocar dívida por empréstimo novo não rende moedas nem conquista', () => {
    const c = A.addAccount({ name: 'Conta', type: 'checking', initialAmount: 0 });
    const old = A.addAccount({ name: 'Velha', type: 'debt', initialAmount: 1000000 });
    const nova = A.addAccount({ name: 'Nova', type: 'debt', initialAmount: 0 });
    A.addTransaction({ kind: 'transfer', amount: 1000000, accountId: nova, toAccountId: c, date: t });
    A.addTransaction({ kind: 'transfer', amount: 1000000, accountId: c, toAccountId: old, date: t });
    const p = computeProgress(getState());
    expect(totals(getState().finance).liabilities).toBe(1000000);
    expect(p.metrics.debtReduction).toBe(0);
    expect(p.metrics.debtsPaidOff).toBe(0);
    expect(p.breakdown[1].coins).toBe(0);
  });
  it('quitar de verdade continua rendendo', () => {
    const c = A.addAccount({ name: 'Conta', type: 'checking', initialAmount: 500000 });
    const d = A.addAccount({ name: 'D', type: 'debt', initialAmount: 300000 });
    A.addTransaction({ kind: 'transfer', amount: 300000, accountId: c, toAccountId: d, date: t });
    const p = computeProgress(getState());
    expect(p.metrics.debtReduction).toBe(300000);
    expect(p.metrics.debtsPaidOff).toBe(1);
  });
  it('pagamento parcial não quita a parcela; completar quita', () => {
    const c = A.addAccount({ name: 'Conta', type: 'checking', initialAmount: 100000 });
    const d = A.addAccount({ name: 'D', type: 'debt', initialAmount: 120000, debt: { installmentAmount: 10000, installmentsTotal: 12, firstDueDate: t } });
    A.payDebtInstallment(d, 1, c, t, 1);
    let inst = debtInstallments(getState().finance, getState().finance.accounts.find((a) => a.id === d)!)[0];
    expect(inst.paid).toBe(false);
    expect(inst.remaining).toBe(9999);
    A.payDebtInstallment(d, 1, c, t, 9999);
    inst = debtInstallments(getState().finance, getState().finance.accounts.find((a) => a.id === d)!)[0];
    expect(inst.paid).toBe(true);
    expect(() => A.payDebtInstallment(d, 1, c, t, 10000)).toThrow();
  });
  it('backup danificado é reparado e nunca trava', () => {
    const cases = [
      { profile: {}, finance: { accounts: [{}] }, game: {} },
      { profile: {}, finance: {}, game: { currentProperty: 'p99', ownedProperties: ['p99'] } },
      { profile: {}, finance: {}, game: { inventory: null, rooms: 5, claims: [] } },
      { profile: { avatar: { skin: 'x' } }, finance: { transactions: [{ id: 'a', kind: 'income', amount: 1.5, date: 'ontem' }] }, game: { inventory: [{ uid: 1, defId: 'nao-existe' }] } },
    ];
    for (const c of cases) {
      const rep = { repairs: [] as string[] };
      const s = normalizeSave(c, rep);
      setState(s, false);
      expect(() => { computeProgress(s); roomInfo(s); calendarEvents(s.finance, addDays(t, -30), t); currentMissions(s); }).not.toThrow();
    }
    expect(() => normalizeSave('oi')).toThrow();
    expect(() => normalizeSave({ foo: 1 })).toThrow();
  });
  it('recorrência semanal respeita o dia da semana', () => {
    const c = A.addAccount({ name: 'Conta', type: 'checking', initialAmount: 0 });
    A.saveRecurring({ name: 'Feira', kind: 'expense', amount: 5000, accountId: c, frequency: 'weekly', day: 6, startDate: '2026-10-01', isSubscription: false, active: true });
    const occ = occurrences(getState().finance.recurring[0], '2026-10-01', '2026-10-31');
    expect(occ).toEqual(['2026-10-03', '2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31']);
  });
  it('assinatura no cartão sai do saldo no mês da fatura', () => {
    A.addAccount({ name: 'Conta', type: 'checking', initialAmount: 100000 });
    const card = A.addAccount({ name: 'Cartão', type: 'credit_card', initialAmount: 0, closingDay: 1, dueDay: 12 });
    const start = addDays(t, 1);
    A.saveRecurring({ name: 'Streaming', kind: 'expense', amount: 5000, accountId: card, frequency: 'monthly', day: Number(start.slice(8)), startDate: start, isSubscription: true, active: true });
    const p = projection(getState().finance, 3);
    expect(p[0].liquid).toBe(100000);
  });
});
