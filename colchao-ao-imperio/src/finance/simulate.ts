import type { Cents } from '../core/money';

/** Quanto tempo para chegar numa meta guardando um valor fixo por mês, com rendimento mensal. */
export function goalTimeline(target: Cents, current: Cents, monthly: Cents, ratePctMonth: number) {
  const r = Math.max(0, ratePctMonth) / 100;
  let bal = current, months = 0, deposited = 0;
  if (bal >= target) return { months: 0, deposited: 0, interest: 0, reachable: true };
  if (monthly <= 0 && r === 0) return { months: Infinity, deposited: 0, interest: 0, reachable: false };
  while (bal < target && months < 1200) {
    bal = Math.round(bal * (1 + r)) + monthly;
    deposited += monthly;
    months++;
  }
  return { months: bal >= target ? months : Infinity, deposited, interest: bal - current - deposited, reachable: bal >= target };
}

/** Quitação de dívida com juros mensais, parcela fixa e um valor extra opcional por mês. */
export function debtPayoff(balance: Cents, ratePctMonth: number, payment: Cents, extra: Cents = 0) {
  const r = Math.max(0, ratePctMonth) / 100;
  let bal = balance, months = 0, interest = 0;
  const pay = payment + extra;
  if (bal <= 0) return { months: 0, interest: 0, payable: true };
  if (pay <= Math.round(bal * r)) return { months: Infinity, interest: Infinity, payable: false };
  while (bal > 0 && months < 1200) {
    const j = Math.round(bal * r);
    interest += j;
    bal = bal + j - pay;
    months++;
  }
  return { months, interest, payable: true };
}

/** Quanto guardar por mês para chegar na meta em N meses (com rendimento). */
export function monthlyNeeded(target: Cents, current: Cents, months: number, ratePctMonth: number): Cents {
  if (months <= 0) return Math.max(0, target - current);
  const r = Math.max(0, ratePctMonth) / 100;
  const fv = current * Math.pow(1 + r, months);
  const rest = target - fv;
  if (rest <= 0) return 0;
  if (r === 0) return Math.ceil(rest / months);
  return Math.ceil(rest * r / (Math.pow(1 + r, months) - 1));
}
