import { describe, expect, it, beforeEach } from 'vitest';
import { formatBRL, parseBRL, splitInstallments } from '../src/core/money';
import { addMonths, todayISO, addDays } from '../src/core/dates';
import { newSave } from '../src/state/defaults';
import { setState, getState } from '../src/state/store';
import * as A from '../src/state/actions';
import { computeProgress } from '../src/game/progress';
import { totals, occurrences, monthSummary } from '../src/finance/ledger';
import { savingsCoins } from '../src/game/rewards';
import { ITEM_LIST, SHOP_ITEMS } from '../src/game/catalog';
import { STYLE_LIST } from '../src/game/styles';
import { ACHIEVEMENTS } from '../src/game/achievements';
import { roomInfo, checkPlacement } from '../src/game/room';
import { PROPERTIES } from '../src/game/properties';

const today = todayISO();

describe('dinheiro', () => {
  it('converte textos em centavos sem float', () => {
    expect(parseBRL('25')).toBe(2500);
    expect(parseBRL('25,5')).toBe(2550);
    expect(parseBRL('1.234,56')).toBe(123456);
    expect(parseBRL('1234.56')).toBe(123456);
    expect(parseBRL('R$ 10,00')).toBe(1000);
    expect(parseBRL('0,1')).toBe(10);
    expect(parseBRL('1.000')).toBe(100000);
    expect(parseBRL('abc')).toBeNull();
    expect(parseBRL('1,234')).toBeNull();
    expect(formatBRL(123456)).toBe('R$ 1.234,56');
    expect(formatBRL(-5)).toBe('-R$ 0,05');
  });
  it('soma de 0,10 + 0,20 é exata', () => {
    expect((parseBRL('0,10')! + parseBRL('0,20')!)).toBe(30);
  });
  it('parcelas somam o total exato', () => {
    const p = splitInstallments(10000, 3);
    expect(p).toEqual([3334, 3333, 3333]);
    expect(p.reduce((a, b) => a + b, 0)).toBe(10000);
  });
  it('soma de meses respeita fim de mês', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
  });
});

describe('fluxo financeiro + recompensas', () => {
  beforeEach(() => setState(newSave(), false));

  it('R$ 25 de economia gera moedas; transferência não gera', () => {
    const c = A.addAccount({ name: 'Carteira', type: 'cash', initialAmount: 10000 });
    const before = computeProgress(getState()).coins;
    // saldo inicial não rende nada (só o dia de atividade + conquistas de organização)
    A.registerSaving({ amount: 2500, accountId: c, mode: 'new-money' });
    const p = computeProgress(getState());
    expect(p.metrics.peakGain).toBe(2500);
    expect(p.coins).toBeGreaterThan(before + 36);
    const r = A.addAccount({ name: 'Reserva', type: 'reserve', initialAmount: 0 });
    const coinsBefore = computeProgress(getState()).coins;
    const xferBefore = computeProgress(getState()).metrics.peakGain;
    A.addTransaction({ kind: 'transfer', amount: 2000, accountId: c, toAccountId: r, date: today });
    A.addTransaction({ kind: 'transfer', amount: 2000, accountId: r, toAccountId: c, date: today });
    A.addTransaction({ kind: 'transfer', amount: 2000, accountId: c, toAccountId: r, date: today });
    const after = computeProgress(getState());
    expect(after.metrics.peakGain).toBe(xferBefore);
    expect(totals(getState().finance).netWorth).toBe(12500);
    // só conquistas de "lançamentos"/reserva podem mudar; o ganho de poupança não
    expect(after.breakdown[0].coins).toBe(computeProgress(getState()).breakdown[0].coins);
    expect(after.coins).toBeGreaterThanOrEqual(coinsBefore);
  });

  it('editar e excluir não duplica moedas', () => {
    const c = A.addAccount({ name: 'Conta', type: 'checking', initialAmount: 0 });
    const id = A.addTransaction({ kind: 'income', amount: 5000, accountId: c, date: today, description: 'freela' });
    const p1 = computeProgress(getState()).breakdown[0].coins;
    A.editTransaction(id, { amount: 1000 });
    A.editTransaction(id, { amount: 5000 });
    A.editTransaction(id, { amount: 1000 });
    A.editTransaction(id, { amount: 5000 });
    expect(computeProgress(getState()).breakdown[0].coins).toBe(p1);
    A.deleteTransaction(id);
    expect(computeProgress(getState()).breakdown[0].coins).toBe(0);
    A.restoreTransaction(id);
    expect(computeProgress(getState()).breakdown[0].coins).toBe(p1);
    const t = getState().finance.transactions.find((x) => x.id === id)!;
    expect(t.history!.length).toBe(6);
  });

  it('gasto real depois não retira moedas já ganhas (pico), mas não deixa somar de novo', () => {
    const c = A.addAccount({ name: 'Conta', type: 'checking', initialAmount: 0 });
    A.addTransaction({ kind: 'income', amount: 10000, accountId: c, date: today });
    const p1 = computeProgress(getState()).breakdown[0].coins;
    A.addTransaction({ kind: 'expense', amount: 10000, accountId: c, date: today });
    expect(computeProgress(getState()).breakdown[0].coins).toBe(p1);
    A.addTransaction({ kind: 'income', amount: 10000, accountId: c, date: today });
    expect(computeProgress(getState()).breakdown[0].coins).toBe(p1);
  });

  it('empréstimo não é enriquecimento e pagar dívida não altera patrimônio', () => {
    const c = A.addAccount({ name: 'Conta', type: 'checking', initialAmount: 50000 });
    const loan = A.addAccount({ name: 'Empréstimo', type: 'debt', initialAmount: 0 });
    A.addTransaction({ kind: 'transfer', amount: 100000, accountId: loan, toAccountId: c, date: today, description: 'empréstimo recebido' });
    const t = totals(getState().finance);
    expect(t.netWorth).toBe(50000);
    expect(t.liabilities).toBe(100000);
    expect(computeProgress(getState()).metrics.peakGain).toBe(0);
    // pagar devolve sem gerar recompensa de dívida (dívida nova)
    A.addTransaction({ kind: 'transfer', amount: 100000, accountId: c, toAccountId: loan, date: today });
    expect(totals(getState().finance).netWorth).toBe(50000);
    expect(computeProgress(getState()).metrics.debtReduction).toBe(0);
  });

  it('quitar dívida antiga atualiza ativos e passivos e conta como conquista', () => {
    const c = A.addAccount({ name: 'Conta', type: 'checking', initialAmount: 30000 });
    const debt = A.addAccount({ name: 'Cartão antigo', type: 'debt', initialAmount: 20000, debt: { installmentAmount: 10000, installmentsTotal: 2, firstDueDate: addDays(today, 10) } });
    expect(totals(getState().finance).netWorth).toBe(10000);
    A.payDebtInstallment(debt, 1, c, today, 10000);
    A.payDebtInstallment(debt, 2, c, today, 10000);
    const t = totals(getState().finance);
    expect(t.assets).toBe(10000);
    expect(t.liabilities).toBe(0);
    expect(t.netWorth).toBe(10000);
    const p = computeProgress(getState());
    expect(p.metrics.debtReduction).toBe(20000);
    expect(p.metrics.debtsPaidOff).toBe(1);
    expect(p.metrics.installmentsPrepaid).toBe(2);
    expect(p.achievements.find((a) => a.def.id === 'debt-off-1')!.unlocked).toBe(true);
    expect(() => A.payDebtInstallment(debt, 2, c, today, 10000)).toThrow();
  });

  it('cartão parcelado lança o total no passivo e divide nas faturas', () => {
    A.addAccount({ name: 'Conta', type: 'checking', initialAmount: 0 });
    const card = A.addAccount({ name: 'Cartão', type: 'credit_card', initialAmount: 0, closingDay: 5, dueDay: 12 });
    A.addTransaction({ kind: 'expense', amount: 30000, accountId: card, date: today, installments: 3, categoryId: 'cat-lazer' });
    const t = getState().finance.transactions[0];
    expect(t.installments!.amounts).toEqual([10000, 10000, 10000]);
    expect(totals(getState().finance).liabilities).toBe(30000);
  });

  it('recorrência confirmada uma vez por ocorrência', () => {
    const c = A.addAccount({ name: 'Conta', type: 'checking', initialAmount: 0 });
    A.saveRecurring({ name: 'Internet', kind: 'expense', amount: 9990, accountId: c, frequency: 'monthly', day: 1, startDate: addMonths(today, -2), isSubscription: true, active: true });
    const r = getState().finance.recurring[0];
    const occ = occurrences(r, addMonths(today, -2), today);
    expect(occ.length).toBeGreaterThanOrEqual(2);
    A.confirmOccurrence(r.id, occ[0]);
    expect(() => A.confirmOccurrence(r.id, occ[0])).toThrow();
    expect(() => A.confirmOccurrence(r.id, addMonths(today, 2))).toThrow();
  });

  it('economia declarada aparece separada das receitas', () => {
    const c = A.addAccount({ name: 'Conta', type: 'checking', initialAmount: 0 });
    A.registerSaving({ amount: 2500, accountId: c, mode: 'new-money' });
    A.addTransaction({ kind: 'income', amount: 100000, accountId: c, date: today, categoryId: 'cat-salario' });
    const s = monthSummary(getState().finance, today.slice(0, 7));
    expect(s.saved).toBe(2500);
    expect(s.income).toBe(100000);
  });

  it('ajuste positivo de saldo não gera moedas', () => {
    const c = A.addAccount({ name: 'Conta', type: 'checking', initialAmount: 0 });
    A.addTransaction({ kind: 'adjustment', amount: 99999900, accountId: c, date: today });
    expect(computeProgress(getState()).metrics.peakGain).toBe(0);
  });

  it('compra virtual não mexe no dinheiro real', () => {
    const c = A.addAccount({ name: 'Conta', type: 'checking', initialAmount: 0 });
    A.registerSaving({ amount: 2500, accountId: c, mode: 'new-money' });
    const nwBefore = totals(getState().finance).netWorth;
    const coins = computeProgress(getState()).coins;
    const cheap = SHOP_ITEMS.filter((i) => !i.minLevel && !i.event && i.price > 0 && i.price <= coins)[0];
    const uid = A.buyItem(cheap.id);
    expect(totals(getState().finance).netWorth).toBe(nwBefore);
    expect(computeProgress(getState()).coinsSpentNet).toBe(-cheap.price);
    const room = roomInfo(getState());
    let placed = false;
    for (let x = 0; x < room.W && !placed; x++) for (let y = 0; y < room.D && !placed; y++) {
      const p = { propertyId: room.propertyId, x, y, rot: cheap.place === 'wall' ? 1 : 0 };
      if (checkPlacement(room, cheap, p, uid).ok) { A.placeItem(uid, p); placed = true; }
    }
    expect(placed).toBe(true);
    expect(getState().game.inventory.find((i) => i.uid === uid)!.placed).not.toBeNull();
  });

  it('não deixa comprar sem moedas', () => {
    const exp = SHOP_ITEMS.find((i) => i.price > 1000 && !i.minLevel)!;
    expect(() => A.buyItem(exp.id)).toThrow();
  });
});

describe('conteúdo', () => {
  it('tem pelo menos 300 itens e variantes na loja', () => {
    expect(SHOP_ITEMS.length + STYLE_LIST.length).toBeGreaterThanOrEqual(300);
  });
  it('ids únicos', () => {
    expect(new Set(ITEM_LIST.map((i) => i.id)).size).toBe(ITEM_LIST.length);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
  it('centenas de conquistas', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(200);
  });
  it('todo imóvel tem móveis iniciais válidos', () => {
    for (const p of PROPERTIES) {
      const s = newSave();
      s.game.ownedProperties = [p.id];
      s.game.currentProperty = p.id;
      s.game.rooms[p.id] = { floor: p.floor, wall: p.wall, light: p.light, expansion: 0, layouts: [] };
      s.game.inventory = p.starter.map((st, i) => ({ uid: i + 1, defId: st.defId, placed: null, acquiredAt: 0 }));
      p.starter.forEach((st, i) => {
        const room = roomInfo(s, p.id);
        const def = ITEM_LIST.find((d) => d.id === st.defId)!;
        expect(def, st.defId).toBeTruthy();
        const chk = checkPlacement(room, def, { propertyId: p.id, x: st.x, y: st.y, rot: st.rot }, i + 1);
        expect(chk.ok, `${p.id} ${st.defId}: ${chk.reason}`).toBe(true);
        s.game.inventory[i].placed = { propertyId: p.id, x: st.x, y: st.y, rot: st.rot };
      });
    }
  });
  it('curva de moedas é generosa no começo', () => {
    expect(savingsCoins(1000)).toBe(15);
    expect(savingsCoins(2500)).toBe(37);
    expect(savingsCoins(100000)).toBe(870);
  });
});
