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

import { debtPayoff, goalTimeline, monthlyNeeded } from '../src/finance/simulate';
describe('simulador', () => {
  it('meta sem rendimento', () => {
    expect(goalTimeline(100000, 0, 10000, 0).months).toBe(10);
    expect(goalTimeline(100000, 100000, 0, 0).months).toBe(0);
    expect(goalTimeline(100000, 0, 0, 0).reachable).toBe(false);
  });
  it('rendimento encurta o prazo', () => {
    expect(goalTimeline(1000000, 0, 50000, 1).months).toBeLessThan(20);
  });
  it('dívida: extra reduz juros; parcela menor que os juros nunca quita', () => {
    const a = debtPayoff(500000, 3, 30000);
    const b = debtPayoff(500000, 3, 30000, 20000);
    expect(b.months).toBeLessThan(a.months);
    expect(b.interest).toBeLessThan(a.interest);
    expect(debtPayoff(500000, 10, 40000).payable).toBe(false);
  });
  it('quanto guardar por mês', () => {
    expect(monthlyNeeded(120000, 0, 12, 0)).toBe(10000);
    expect(monthlyNeeded(120000, 0, 12, 1)).toBeLessThan(10000);
  });
});

import { interpretStatement } from '../src/finance/csv';
describe('importar extratos', () => {
  const ofx = `OFXHEADER:100\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261005120000[-3:BRT]<TRNAMT>-45.90<FITID>abc1<MEMO>Mercado Bom Preço
</STMTTRN><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261010<TRNAMT>3500.00<FITID>abc2<MEMO>Salario
</STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
  it('OFX', () => {
    const r = interpretStatement(ofx, newSave().finance);
    expect(r.map((x) => [x.date, x.kind, x.amount, x.extId])).toEqual([['2026-10-05', 'expense', 4590, 'abc1'], ['2026-10-10', 'income', 350000, 'abc2']]);
  });
  it('não importa duas vezes o mesmo FITID', () => {
    const c = A.addAccount({ name: 'Conta', type: 'checking', initialAmount: 0 });
    A.addTransaction({ kind: 'expense', amount: 4590, accountId: c, date: '2026-10-05', description: 'outro nome', tags: ['ext:abc1'] });
    const r = interpretStatement(ofx, getState().finance);
    expect(r[0].duplicate).toBe(true);
    expect(r[1].duplicate).toBe(false);
  });
  it('Nubank cartão (valor positivo é gasto) e conta', () => {
    const card = interpretStatement('date,category,title,amount\n2026-10-03,restaurante,Lanchonete,32.50\n2026-10-04,,Estorno,-10.00', newSave().finance);
    expect(card.map((x) => [x.kind, x.amount])).toEqual([['expense', 3250], ['income', 1000]]);
    const conta = interpretStatement('Data,Valor,Identificador,Descrição\n05/10/2026,-120.00,xyz,Conta de luz', newSave().finance);
    expect([conta[0].date, conta[0].kind, conta[0].amount, conta[0].extId, conta[0].description]).toEqual(['2026-10-05', 'expense', 12000, 'xyz', 'Conta de luz']);
  });
  it('Inter/Itaú com ponto e vírgula e saldo', () => {
    const r = interpretStatement('Data Lançamento;Histórico;Valor;Saldo\n01/10/2026;PIX RECEBIDO;1.250,00;3.000,00\n02/10/2026;Farmácia;-89,90;2.910,10', newSave().finance);
    expect(r.map((x) => [x.kind, x.amount, x.description])).toEqual([['income', 125000, 'PIX RECEBIDO'], ['expense', 8990, 'Farmácia']]);
  });
});

import { decodeTransfer, encodeTransfer } from '../src/core/transfer';
import { mergeSaves } from '../src/state/merge';
describe('sincronização entre aparelhos', () => {
  it('código cifrado: ida e volta, senha errada falha', async () => {
    const s = newSave(); s.profile.name = 'Kauê';
    const code = await encodeTransfer(s, 'segredo123');
    expect(code.startsWith('CIMP1:')).toBe(true);
    expect(code).not.toContain('Kauê');
    const back = await decodeTransfer(code, 'segredo123') as typeof s;
    expect(back.profile.name).toBe('Kauê');
    await expect(decodeTransfer(code, 'errada')).rejects.toThrow();
    await expect(decodeTransfer(code.slice(0, 40), 'segredo123')).rejects.toThrow();
  });
  it('juntar dados une lançamentos dos dois aparelhos sem duplicar', () => {
    setState(newSave(), false);
    const c = A.addAccount({ name: 'Conta', type: 'checking', initialAmount: 0 });
    A.addTransaction({ kind: 'income', amount: 1000, accountId: c, date: t, description: 'comum' });
    const base = structuredClone(getState());
    // celular
    setState(structuredClone(base), false);
    A.addTransaction({ kind: 'expense', amount: 300, accountId: c, date: t, description: 'no celular' });
    const phone = getState();
    // pc
    setState(structuredClone(base), false);
    const id = A.addTransaction({ kind: 'expense', amount: 500, accountId: c, date: t, description: 'no pc' });
    A.deleteTransaction(id);
    const pc = getState();
    const { merged, summary } = mergeSaves(pc, phone);
    expect(summary.newTx).toBe(1);
    const live = merged.finance.transactions.filter((x) => !x.deleted).map((x) => x.description).sort();
    expect(live).toEqual(['comum', 'no celular']);
    expect(merged.finance.transactions.length).toBe(3);
    // juntar de novo não duplica
    expect(mergeSaves(merged, phone).merged.finance.transactions.length).toBe(3);
  });
});
