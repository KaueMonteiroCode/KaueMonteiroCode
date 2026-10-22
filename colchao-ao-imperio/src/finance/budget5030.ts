import type { Cents } from '../core/money';
import { lastMonths, monthSummary } from './ledger';
import type { FinanceState } from '../state/types';

/** Categorias de necessidades (50%); o resto das despesas vira "desejos" (30%); 20% é para guardar. */
export const NEEDS = new Set(['cat-moradia', 'cat-mercado', 'cat-transporte', 'cat-contas', 'cat-saude', 'cat-educacao', 'cat-juros']);

export interface BudgetSuggestion { income: Cents; save: Cents; lines: { categoryId: string; group: 'necessidades' | 'desejos'; limit: Cents; spent: Cents }[] }

/** Sugere limites por categoria: 50% necessidades, 30% desejos, proporcional ao que você já gasta. */
export function suggest503020(fin: FinanceState): BudgetSuggestion | null {
  const months = lastMonths(4).slice(0, 3);
  const sums = months.map((m) => monthSummary(fin, m)).filter((s) => s.count > 0);
  const cur = monthSummary(fin, lastMonths(1)[0]);
  const pool = sums.length ? sums : [cur];
  const income = Math.round(pool.reduce((a, s) => a + s.income, 0) / pool.length);
  if (income <= 0) return null;
  const spent = new Map<string, number>();
  for (const s of pool) for (const [k, v] of s.byCategory) spent.set(k, (spent.get(k) ?? 0) + v / pool.length);
  const cats = fin.categories.filter((c) => c.kind === 'expense');
  const lines: BudgetSuggestion['lines'] = [];
  for (const group of ['necessidades', 'desejos'] as const) {
    const total = Math.round(income * (group === 'necessidades' ? 0.5 : 0.3));
    const members = cats.filter((c) => (group === 'necessidades') === NEEDS.has(c.id));
    const used = members.reduce((a, c) => a + (spent.get(c.id) ?? 0), 0);
    let left = total;
    members.forEach((c, i) => {
      const share = used > 0 ? (spent.get(c.id) ?? 0) / used : 1 / members.length;
      const limit = i === members.length - 1 ? left : Math.round(total * share);
      left -= limit;
      if (limit > 0) lines.push({ categoryId: c.id, group, limit, spent: Math.round(spent.get(c.id) ?? 0) });
    });
  }
  return { income, save: Math.round(income * 0.2), lines };
}
