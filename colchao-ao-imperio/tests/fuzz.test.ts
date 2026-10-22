import { describe, expect, it } from 'vitest';
import { addDays, todayISO } from '../src/core/dates';
import { newSave } from '../src/state/defaults';
import { getState, setState } from '../src/state/store';
import * as A from '../src/state/actions';
import { computeProgress } from '../src/game/progress';
import { activeTx, calendarEvents, debtInstallments, netWorthEffect, projection, totals, cardInvoiceStatus } from '../src/finance/ledger';
import { SHOP_ITEMS, getItem } from '../src/game/catalog';
import { checkPlacement, findFreeSpot, roomInfo } from '../src/game/room';
import { currentMissions } from '../src/game/missions';
import { rotFootprint } from '../src/engine/prims';

/** Gerador pseudoaleatório determinístico */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
const today = todayISO();
const quiet = <T,>(fn: () => T) => { try { return fn(); } catch (e) { if (e instanceof A.ActionError) return undefined; throw e; } };

describe('fuzz: regras financeiras nunca quebram', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    it(`semente ${seed}`, () => {
      const r = rng(seed);
      setState(newSave(), false);
      const accs = [
        A.addAccount({ name: 'Conta', type: 'checking', initialAmount: Math.floor(r() * 500000) }),
        A.addAccount({ name: 'Reserva', type: 'reserve', initialAmount: 0 }),
        A.addAccount({ name: 'Cartão', type: 'credit_card', initialAmount: Math.floor(r() * 50000), closingDay: 5, dueDay: 12 }),
        A.addAccount({ name: 'Dívida', type: 'debt', initialAmount: 300000, debt: { installmentAmount: 25000, installmentsTotal: 12, firstDueDate: addDays(today, -60) } }),
      ];
      let maxSavingsCoins = 0;
      for (let i = 0; i < 250; i++) {
        const s = getState();
        const live = s.finance.transactions;
        const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
        const amt = 1 + Math.floor(r() * 80000);
        const date = addDays(today, -Math.floor(r() * 120));
        const op = r();
        if (op < 0.25) quiet(() => A.addTransaction({ kind: 'income', amount: amt, accountId: pick(accs.slice(0, 2)), date, saving: r() < 0.3 }));
        else if (op < 0.45) quiet(() => A.addTransaction({ kind: 'expense', amount: amt, accountId: pick(accs), date, installments: r() < 0.3 ? 2 + Math.floor(r() * 10) : undefined }));
        else if (op < 0.6) quiet(() => A.addTransaction({ kind: 'transfer', amount: amt, accountId: pick(accs), toAccountId: pick(accs), date }));
        else if (op < 0.68) quiet(() => A.payDebtInstallment(accs[3], 1 + Math.floor(r() * 12), accs[0], date, 25000));
        else if (op < 0.78 && live.length) quiet(() => A.editTransaction(pick(live).id, { amount: amt, date }));
        else if (op < 0.88 && live.length) quiet(() => A.deleteTransaction(pick(live).id));
        else if (op < 0.93 && live.length) quiet(() => A.restoreTransaction(pick(live).id));
        else quiet(() => A.addTransaction({ kind: 'adjustment', amount: (r() < 0.5 ? -1 : 1) * amt, accountId: pick(accs), date }));

        const st = getState();
        // patrimônio = saldos iniciais + efeitos dos lançamentos confirmados até hoje
        const expected = st.finance.accounts.reduce((a, x) => a + x.initialBalance, 0)
          + st.finance.transactions.filter((t) => activeTx(t) && t.date <= today).reduce((a, t) => a + netWorthEffect(t), 0);
        expect(totals(st.finance).netWorth).toBe(expected);
        const p = computeProgress(st);
        expect(Number.isFinite(p.coins)).toBe(true);
        maxSavingsCoins = Math.max(maxSavingsCoins, p.breakdown[0].coins);
        // telas derivadas não podem lançar exceção
        calendarEvents(st.finance, addDays(today, -200), addDays(today, 200));
        projection(st.finance, 6);
        currentMissions(st);
        for (const c of st.finance.accounts.filter((a) => a.type === 'credit_card')) {
          for (const v of cardInvoiceStatus(st.finance, c).values()) expect(v.remaining).toBeGreaterThanOrEqual(0);
        }
        // contagens nunca passam do possível
        const m = computeProgress(st).metrics;
        expect(m.debtsPaidOff).toBeLessThanOrEqual(st.finance.accounts.filter((a) => a.initialBalance < 0).length);
        expect(m.installmentsPaid).toBeLessThanOrEqual(st.finance.accounts.reduce((x, a) => x + debtInstallments(st.finance, a).length, 0));
        expect(m.debtReduction).toBeLessThanOrEqual(st.finance.accounts.reduce((x, a) => x + Math.max(0, -a.initialBalance), 0));
      }
      // apagar tudo zera as moedas de economia: editar/recriar não deixa "resto"
      for (const t of getState().finance.transactions) if (!t.deleted) A.deleteTransaction(t.id);
      const end = computeProgress(getState());
      expect(end.breakdown[0].coins).toBe(0);
      expect(end.breakdown[1].coins).toBe(0);
      expect(maxSavingsCoins).toBeGreaterThanOrEqual(0);
    });
  }
});

describe('fuzz: decoração nunca sobrepõe móveis', () => {
  for (const seed of [11, 12, 13]) {
    it(`semente ${seed}`, () => {
      const r = rng(seed);
      const s0 = newSave();
      s0.game.claims['teste'] = { at: 0, coins: 200000, xp: 0, label: 'teste' };
      setState(s0, false);
      const cheap = SHOP_ITEMS.filter((i) => !i.minLevel && !i.event && i.price < 400);
      for (let i = 0; i < 300; i++) {
        const s = getState();
        const inv = s.game.inventory.filter((x) => !x.locked);
        const op = r();
        if (op < 0.35) {
          const def = cheap[Math.floor(r() * cheap.length)];
          quiet(() => A.buyItem(def.id));
        } else if (op < 0.75 && inv.length) {
          const it = inv[Math.floor(r() * inv.length)];
          const def = getItem(it.defId)!;
          const room = roomInfo(s);
          const p = r() < 0.5 ? findFreeSpot(room, def) : { propertyId: room.propertyId, x: Math.floor(r() * room.W), y: Math.floor(r() * room.D), rot: Math.floor(r() * 4) % (def.place === 'wall' ? 2 : 4) };
          if (p) quiet(() => A.placeItem(it.uid, p));
        } else if (op < 0.85 && inv.length) quiet(() => A.storeItem(inv[Math.floor(r() * inv.length)].uid));
        else if (inv.length) quiet(() => A.sellItem(inv[Math.floor(r() * inv.length)].uid));

        // invariantes do ambiente
        const room = roomInfo(getState());
        const floor = new Set<string>();
        for (const pi of room.placed) {
          if (pi.def.place === 'wall') continue;
          const fp = rotFootprint(pi.def.w, pi.def.d, pi.p.rot);
          expect(pi.p.x >= 0 && pi.p.y >= 0 && pi.p.x + fp.w <= room.W && pi.p.y + fp.d <= room.D, `${pi.def.id} fora do ambiente`).toBe(true);
          if (pi.def.place !== 'floor') continue;
          for (let x = pi.p.x; x < pi.p.x + fp.w; x++) for (let y = pi.p.y; y < pi.p.y + fp.d; y++) {
            const k = `${x},${y}`;
            expect(floor.has(k), `sobreposição em ${k}`).toBe(false);
            floor.add(k);
          }
        }
        // itens de mesa sempre sobre uma superfície válida ou no chão livre
        for (const pi of room.placed) {
          if (pi.def.place !== 'top') continue;
          const chk = checkPlacement(room, pi.def, pi.p, pi.item.uid);
          expect(chk.ok, `${pi.def.id} em posição inválida: ${chk.reason}`).toBe(true);
        }
      }
    });
  }
});
