import { todayISO } from '../core/dates';
import type { SaveData } from '../state/types';
import { ACHIEVEMENTS, type AchDef } from './achievements';
import { TITLES } from './meta';
import { computeMetrics, COINS_PER_ACTIVE_DAY, debtCoins, levelFromXp, savingsCoins, XP_PER_ACTIVE_DAY, type Metrics } from './rewards';

export interface AchState { def: AchDef; cur: number; target: number; unlocked: boolean; coins: number }

export interface Progress {
  metrics: Metrics;
  achievements: AchState[];
  unlockedCount: number;
  coinsEarned: number;
  coinsSpentNet: number; // soma do livro de moedas (compras negativas, vendas positivas)
  coins: number; // saldo disponível
  xp: number;
  level: number;
  levelInfo: ReturnType<typeof levelFromXp>;
  titles: { id: string; name: string; unlocked: boolean; how: string }[];
  breakdown: { label: string; coins: number; xp: number }[];
}

// cache por save E por dia (missões e métricas mudam na virada do dia)
const cache = new WeakMap<SaveData, Map<string, Progress>>();

export function computeProgress(save: SaveData, today = todayISO()): Progress {
  const hit = cache.get(save)?.get(today);
  if (hit) return hit;
  const m = computeMetrics(save, today);
  const owned = new Set(save.game.inventory.map((i) => i.defId));

  const sCoins = savingsCoins(m.peakGain);
  const dCoins = debtCoins(m.debtReduction);
  const actCoins = m.activityDays * COINS_PER_ACTIVE_DAY;
  const claims = Object.values(save.game.claims);
  const claimCoins = claims.reduce((a, c) => a + c.coins, 0);
  const claimXp = claims.reduce((a, c) => a + c.xp, 0);

  // 1ª passada: conquistas sem dependência de nível
  const ctx0 = { m, level: 1, owned };
  let achXp = 0;
  const pre = ACHIEVEMENTS.map((def) => {
    if (def.group === 'nivel') return null;
    const [cur, target] = def.progress(ctx0);
    const unlocked = cur >= target;
    if (unlocked && !def.noXp) achXp += def.xp;
    return { def, cur, target, unlocked };
  });
  const baseXp = sCoins + dCoins + m.activityDays * XP_PER_ACTIVE_DAY + achXp + claimXp;
  const levelInfo = levelFromXp(baseXp);
  const ctx = { m, level: levelInfo.level, owned };

  let achCoins = 0;
  const achievements: AchState[] = ACHIEVEMENTS.map((def, i) => {
    const p = pre[i];
    const [cur, target] = p ? [p.cur, p.target] : def.progress(ctx);
    const unlocked = cur >= target;
    let coins = def.coins;
    if (def.coinsFor) { const c = def.coinsFor(ctx); if (c >= 0) coins = c; }
    if (unlocked) achCoins += coins;
    return { def, cur, target, unlocked, coins };
  });

  const coinsEarned = sCoins + dCoins + actCoins + achCoins + claimCoins;
  const coinsSpentNet = save.game.coinLedger.reduce((a, e) => a + e.amount, 0);
  const unlockedIds = new Set(achievements.filter((a) => a.unlocked).map((a) => a.def.id));

  const res: Progress = {
    metrics: m,
    achievements,
    unlockedCount: unlockedIds.size,
    coinsEarned,
    coinsSpentNet,
    coins: coinsEarned + coinsSpentNet,
    xp: baseXp,
    level: levelInfo.level,
    levelInfo,
    titles: TITLES.map((t) => ({
      id: t.id, name: t.name,
      unlocked: t.level ? levelInfo.level >= t.level : !!t.ach && unlockedIds.has(t.ach),
      how: t.level ? `Nível ${t.level}` : `Conquista: ${ACHIEVEMENTS.find((a) => a.id === t.ach)?.name ?? t.ach}`,
    })),
    breakdown: [
      { label: 'Economia (pico de patrimônio)', coins: sCoins, xp: sCoins },
      { label: 'Redução de dívidas', coins: dCoins, xp: dCoins },
      { label: 'Dias com registros', coins: actCoins, xp: m.activityDays * XP_PER_ACTIVE_DAY },
      { label: 'Conquistas', coins: achCoins, xp: achXp },
      { label: 'Missões e presentes', coins: claimCoins, xp: claimXp },
    ],
  };
  if (!cache.has(save)) cache.set(save, new Map());
  cache.get(save)!.set(today, res);
  return res;
}
