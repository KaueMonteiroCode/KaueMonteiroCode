import type { SaveData, Transaction } from './types';

export interface MergeSummary { newTx: number; updatedTx: number; newAccounts: number; newGoals: number; newRecurring: number; gameFrom: 'este aparelho' | 'outro aparelho' }

function unionBy<T>(a: T[], b: T[], key: (x: T) => string, pick: (x: T, y: T) => T = (x) => x): T[] {
  const m = new Map<string, T>();
  for (const x of a) m.set(key(x), x);
  for (const y of b) { const k = key(y); const x = m.get(k); m.set(k, x ? pick(x, y) : y); }
  return [...m.values()];
}

/**
 * Junta dois saves (já validados) por entidade:
 * - lançamentos: união por id; se existir dos dois lados, vale a versão editada por último;
 * - contas, metas, recorrências, categorias, orçamentos: união (este aparelho vence empates);
 * - jogo (decoração, compras, perfil): vem do aparelho usado por último; missões resgatadas,
 *   dias com registro e conquistas vistas são somados.
 */
export function mergeSaves(local: SaveData, remote: SaveData): { merged: SaveData; summary: MergeSummary } {
  const localTx = new Map(local.finance.transactions.map((t) => [t.id, t]));
  let newTx = 0, updatedTx = 0;
  const pickTx = (x: Transaction, y: Transaction) => {
    if ((y.updatedAt ?? 0) > (x.updatedAt ?? 0)) { updatedTx++; return y; }
    return x;
  };
  for (const t of remote.finance.transactions) if (!localTx.has(t.id)) newTx++;
  const remoteNewer = remote.savedAt > local.savedAt;
  const g = remoteNewer ? remote : local;
  const merged: SaveData = {
    ...local,
    savedAt: Date.now(),
    profile: remoteNewer ? remote.profile : local.profile,
    settings: local.settings,
    finance: {
      accounts: unionBy(local.finance.accounts, remote.finance.accounts, (a) => a.id),
      categories: unionBy(local.finance.categories, remote.finance.categories, (c) => c.id),
      transactions: unionBy(local.finance.transactions, remote.finance.transactions, (t) => t.id, pickTx),
      recurring: unionBy(local.finance.recurring, remote.finance.recurring, (r) => r.id),
      goals: unionBy(local.finance.goals, remote.finance.goals, (x) => x.id),
      budgets: unionBy(local.finance.budgets, remote.finance.budgets, (b) => b.categoryId),
      audit: unionBy(local.finance.audit, remote.finance.audit, (a) => `${a.at}|${a.action}|${a.detail}`).sort((a, b) => a.at - b.at).slice(-3000),
    },
    game: {
      ...g.game,
      claims: { ...remote.game.claims, ...local.game.claims },
      activityDays: [...new Set([...local.game.activityDays, ...remote.game.activityDays])].sort(),
      seenAchievements: { ...remote.game.seenAchievements, ...local.game.seenAchievements },
      wishlist: [...new Set([...local.game.wishlist, ...remote.game.wishlist])],
    },
  };
  const ids = new Set(local.finance.accounts.map((a) => a.id));
  return {
    merged,
    summary: {
      newTx, updatedTx,
      newAccounts: remote.finance.accounts.filter((a) => !ids.has(a.id)).length,
      newGoals: remote.finance.goals.filter((x) => !local.finance.goals.some((y) => y.id === x.id)).length,
      newRecurring: remote.finance.recurring.filter((x) => !local.finance.recurring.some((y) => y.id === x.id)).length,
      gameFrom: remoteNewer ? 'outro aparelho' : 'este aparelho',
    },
  };
}
