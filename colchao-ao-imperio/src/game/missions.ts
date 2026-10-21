import { addDays, todayISO, weekKey } from '../core/dates';
import { activeTx, calendarEvents, netWorthEffect } from '../finance/ledger';
import type { SaveData } from '../state/types';
import { activeEvents } from './meta';

/**
 * Missões: diárias e semanais ligadas a hábitos saudáveis (registrar, revisar, pagar em dia,
 * guardar dinheiro). Nunca incentivam gastar. Cada missão só pode ser resgatada uma vez por período.
 * Missões de história guiam o começo do jogo.
 */
export interface MissionCtx { save: SaveData; today: string }
export interface MissionDef {
  id: string;
  name: string;
  desc: string;
  coins: number;
  xp: number;
  check: (c: MissionCtx) => [number, number];
}
export interface MissionInstance extends MissionDef { key: string; period: 'diaria' | 'semanal' | 'historia' | 'evento'; claimed: boolean; done: boolean; cur: number; target: number }

const createdOn = (s: SaveData, day: string) => s.finance.transactions.filter((t) => !t.deleted && dayOf(t.createdAt) === day);
const dayOf = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const createdInWeek = (s: SaveData, wk: string) => s.finance.transactions.filter((t) => !t.deleted && weekKey(dayOf(t.createdAt)) === wk);

const DAILY_POOL: MissionDef[] = [
  { id: 'reg', name: 'Registro do dia', desc: 'Registre pelo menos 1 movimentação hoje.', coins: 8, xp: 15, check: ({ save, today }) => [save.game.activityDays.includes(today) ? 1 : 0, 1] },
  { id: 'review', name: 'Olhada rápida', desc: 'Abra o painel financeiro hoje.', coins: 3, xp: 5, check: ({ save, today }) => [save.game.visits[`fin:${today}`] ? 1 : 0, 1] },
  { id: 'cat', name: 'Tudo categorizado', desc: 'Registre hoje um lançamento com categoria.', coins: 5, xp: 10, check: ({ save, today }) => [createdOn(save, today).some((t) => t.categoryId) ? 1 : 0, 1] },
  { id: 'confirm', name: 'Compromisso em dia', desc: 'Confirme hoje uma conta, parcela ou recorrência do calendário.', coins: 10, xp: 20, check: ({ save, today }) => [createdOn(save, today).some((t) => t.recurringId || t.debtInstallment) ? 1 : 0, 1] },
  { id: 'save', name: 'Cofrinho do dia', desc: 'Registre hoje uma economia ou receita.', coins: 8, xp: 15, check: ({ save, today }) => [createdOn(save, today).some((t) => t.kind === 'income') ? 1 : 0, 1] },
  { id: 'calendar', name: 'Planejador', desc: 'Abra o calendário de pagamentos hoje.', coins: 3, xp: 5, check: ({ save, today }) => [save.game.visits[`calendario:${today}`] ? 1 : 0, 1] },
  { id: 'goal', name: 'Foco na meta', desc: 'Abra suas metas hoje.', coins: 3, xp: 5, check: ({ save, today }) => [save.game.visits[`metas:${today}`] ? 1 : 0, 1] },
];

const WEEKLY_POOL: MissionDef[] = [
  { id: 'w-days', name: 'Semana organizada', desc: 'Registre movimentações em 4 dias diferentes nesta semana.', coins: 40, xp: 60, check: ({ save, today }) => { const wk = weekKey(today); return [save.game.activityDays.filter((d) => weekKey(d) === wk).length, 4]; } },
  { id: 'w-gain', name: 'Semana no azul', desc: 'Termine a semana com patrimônio maior que no começo dela.', coins: 50, xp: 80, check: ({ save, today }) => {
    const wk = weekKey(today);
    const end = addDays(wk, 6);
    const delta = save.finance.transactions.filter((t) => activeTx(t) && t.date >= wk && t.date <= end && t.date <= today && !(t.kind === 'adjustment' && t.amount > 0)).reduce((a, t) => a + netWorthEffect(t), 0);
    return [delta > 0 ? 1 : 0, 1];
  } },
  { id: 'w-bills', name: 'Contas da semana pagas', desc: 'Confirme todas as contas e parcelas que venceram nesta semana (precisa ter ao menos uma).', coins: 40, xp: 60, check: ({ save, today }) => {
    const wk = weekKey(today);
    const ev = calendarEvents(save.finance, wk, today).filter((e) => (e.kind === 'recurring' && e.amount < 0) || e.kind === 'debt');
    return [ev.length > 0 && ev.every((e) => e.done) ? 1 : 0, 1];
  } },
  { id: 'w-guard', name: 'Guardar para o futuro', desc: 'Transfira qualquer valor para uma conta de poupança, reserva ou investimento nesta semana.', coins: 25, xp: 40, check: ({ save, today }) => {
    const wk = weekKey(today);
    const guarded = new Set(save.finance.accounts.filter((a) => ['savings', 'reserve', 'investment'].includes(a.type)).map((a) => a.id));
    return [createdInWeek(save, wk).some((t) => t.kind === 'transfer' && t.toAccountId && guarded.has(t.toAccountId) && !guarded.has(t.accountId)) ? 1 : 0, 1];
  } },
  { id: 'w-stats', name: 'Análise semanal', desc: 'Abra as estatísticas nesta semana.', coins: 10, xp: 15, check: ({ save, today }) => { const wk = weekKey(today); return [Object.keys(save.game.visits).some((k) => k.startsWith('estatisticas:') && weekKey(k.split(':')[1]) === wk) ? 1 : 0, 1]; } },
];

export const STORY: MissionDef[] = [
  { id: 's1', name: 'O primeiro passo', desc: 'Registre sua primeira economia (a partir de R$ 10).', coins: 20, xp: 30, check: ({ save }) => [save.finance.transactions.some((t) => !t.deleted && t.kind === 'income' && t.amount >= 1000) ? 1 : 0, 1] },
  { id: 's2', name: 'Às compras (virtuais)', desc: 'Compre seu primeiro item na loja com moedas.', coins: 10, xp: 15, check: ({ save }) => [save.game.coinLedger.some((e) => e.kind === 'buy') ? 1 : 0, 1] },
  { id: 's3', name: 'Decorador iniciante', desc: 'Posicione um item comprado no quarto.', coins: 10, xp: 15, check: ({ save }) => [save.game.inventory.some((i) => i.placed && save.game.coinLedger.some((e) => e.kind === 'buy' && e.ref === String(i.uid))) ? 1 : 0, 1] },
  { id: 's4', name: 'Conta cadastrada', desc: 'Cadastre uma conta (corrente, carteira ou poupança).', coins: 10, xp: 15, check: ({ save }) => [save.finance.accounts.length > 0 ? 1 : 0, 1] },
  { id: 's5', name: 'Meta definida', desc: 'Crie sua primeira meta de economia.', coins: 15, xp: 20, check: ({ save }) => [save.finance.goals.length > 0 ? 1 : 0, 1] },
  { id: 's6', name: 'Contas sob controle', desc: 'Cadastre uma despesa recorrente ou assinatura.', coins: 15, xp: 20, check: ({ save }) => [save.finance.recurring.length > 0 ? 1 : 0, 1] },
  { id: 's7', name: 'Reserva de emergência', desc: 'Crie uma conta do tipo Reserva e coloque qualquer valor nela.', coins: 25, xp: 40, check: ({ save }) => { const ids = new Set(save.finance.accounts.filter((a) => a.type === 'reserve').map((a) => a.id)); return [save.finance.accounts.some((a) => a.type === 'reserve' && a.initialBalance > 0) || save.finance.transactions.some((t) => !t.deleted && (ids.has(t.toAccountId ?? '') || (ids.has(t.accountId) && t.kind === 'income'))) ? 1 : 0, 1]; } },
  { id: 's8', name: 'Orçamento', desc: 'Defina um limite de orçamento para uma categoria.', coins: 15, xp: 20, check: ({ save }) => [save.finance.budgets.length > 0 ? 1 : 0, 1] },
  { id: 's9', name: 'Cofre de segurança', desc: 'Faça um backup dos seus dados.', coins: 15, xp: 20, check: ({ save }) => [save.game.visits['backup'] ? 1 : 0, 1] },
];

function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function pick<T>(pool: T[], n: number, seed: string): T[] {
  const arr = [...pool];
  const out: T[] = [];
  let h = hash(seed);
  while (out.length < n && arr.length) { out.push(arr.splice(h % arr.length, 1)[0]); h = hash(String(h)); }
  return out;
}

export function currentMissions(save: SaveData, today = todayISO()): MissionInstance[] {
  const ctx: MissionCtx = { save, today };
  const mk = (d: MissionDef, key: string, period: MissionInstance['period']): MissionInstance => {
    const [cur, target] = d.check(ctx);
    return { ...d, key, period, cur, target, done: cur >= target, claimed: !!save.game.claims[key] };
  };
  const daily = pick(DAILY_POOL.slice(1), 2, today).concat(DAILY_POOL[0]).map((d) => mk(d, `d:${today}:${d.id}`, 'diaria'));
  const wk = weekKey(today);
  const weekly = pick(WEEKLY_POOL, 3, wk).map((d) => mk(d, `w:${wk}:${d.id}`, 'semanal'));
  // história: mostra as não resgatadas (até 3)
  const story = STORY.map((d) => mk(d, `s:${d.id}`, 'historia')).filter((m) => !m.claimed).slice(0, 3);
  const year = today.slice(0, 4);
  const events = activeEvents(today).map((ev) => mk({ id: ev.id, name: `${ev.name}: ${ev.bonusMission.name}`, desc: ev.bonusMission.desc, coins: ev.bonusMission.coins, xp: ev.bonusMission.coins, check: EVENT_CHECKS[ev.id] ?? (() => [0, 1]) }, `e:${year}:${ev.id}`, 'evento'));
  return [...story, ...events, ...daily, ...weekly];
}

const inMonth = (s: SaveData, today: string) => s.finance.transactions.filter((t) => activeTx(t) && t.date.slice(0, 7) === today.slice(0, 7) && t.date <= today);
const EVENT_CHECKS: Record<string, MissionDef['check']> = {
  'ev-janeiro': ({ save }) => [Math.min(3, save.finance.budgets.length), 3],
  'ev-consumidor': ({ save, today }) => [Math.min(5, createdInWeek(save, weekKey(today)).filter((t) => t.kind === 'expense' && t.categoryId).length), 5],
  'ev-cofrinho': ({ save, today }) => { const g = inMonth(save, today).filter((t) => !(t.kind === 'adjustment' && t.amount > 0)).reduce((a, t) => a + netWorthEffect(t), 0); return [Math.max(0, Math.min(5000, g)), 5000]; },
  'ev-blackfriday': ({ save, today }) => { const from = today.slice(0, 5) + '11-15'; const list = save.finance.transactions.filter((t) => !t.deleted && t.date >= from && t.date <= today); return [list.length > 0 && !list.some((t) => t.installments) && today.slice(5) >= '11-30' ? 1 : 0, 1]; },
  'ev-dezembro': ({ save, today }) => { const guarded = new Set(save.finance.accounts.filter((a) => ['reserve', 'investment', 'savings'].includes(a.type)).map((a) => a.id)); return [inMonth(save, today).some((t) => t.kind === 'transfer' && guarded.has(t.toAccountId ?? '')) ? 1 : 0, 1]; },
};

export const MISSION_POOLS = { DAILY_POOL, WEEKLY_POOL, STORY };
