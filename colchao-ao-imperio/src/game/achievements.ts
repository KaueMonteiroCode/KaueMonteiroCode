import { formatBRL } from '../core/money';
import type { Metrics } from './rewards';
import { COLLECTIONS, collectionItems } from './catalog';

export type AchGroup =
  | 'poupanca' | 'patrimonio' | 'dividas' | 'constancia' | 'organizacao' | 'meses' | 'metas'
  | 'decoracao' | 'imoveis' | 'nivel' | 'colecoes' | 'personagem';

export const GROUPS: Record<AchGroup, { name: string; color: string; desc: string }> = {
  poupanca: { name: 'Poupança', color: '#4ade80', desc: 'Ganho real de patrimônio desde o início.' },
  patrimonio: { name: 'Patrimônio líquido', color: '#22d3ee', desc: 'Tudo que você tem menos tudo que deve.' },
  dividas: { name: 'Dívidas', color: '#f87171', desc: 'Quitar e reduzir dívidas existentes.' },
  constancia: { name: 'Constância', color: '#fbbf24', desc: 'Registrar com regularidade (sem punição por faltas).' },
  organizacao: { name: 'Organização', color: '#a78bfa', desc: 'Manter o controle financeiro em dia.' },
  meses: { name: 'Meses', color: '#34d399', desc: 'Meses fechados no azul e dentro do orçamento.' },
  metas: { name: 'Metas e reserva', color: '#60a5fa', desc: 'Metas de economia e reserva de emergência.' },
  decoracao: { name: 'Decoração', color: '#f472b6', desc: 'Montar o seu espaço.' },
  imoveis: { name: 'Imóveis', color: '#fb923c', desc: 'Do quarto ao complexo empresarial.' },
  nivel: { name: 'Nível', color: '#e2b53f', desc: 'Evolução do jogador.' },
  colecoes: { name: 'Coleções', color: '#c084fc', desc: 'Conjuntos completos de móveis.' },
  personagem: { name: 'Personagem', color: '#f9a8d4', desc: 'Estilo próprio.' },
};

export interface AchCtx { m: Metrics; level: number; owned: Set<string> }

export interface AchDef {
  id: string;
  group: AchGroup;
  name: string;
  desc: string;
  tier: number; // 1..6 (raridade)
  coins: number;
  xp: number;
  /** índice dentro da cadeia (árvore) */
  step: number;
  progress: (c: AchCtx) => [number, number];
  /** formata valores de progresso */
  money?: boolean;
  /** retorna moedas efetivas (ex.: zero se o jogador já começou acima do marco) */
  coinsFor?: (c: AchCtx) => number;
  noXp?: boolean;
}

const A: AchDef[] = [];
const tierFor = (i: number, n: number) => Math.min(6, 1 + Math.floor((i / Math.max(1, n - 1)) * 5.2));

function chain(group: AchGroup, values: number[], mk: (v: number, i: number) => Omit<AchDef, 'group' | 'step' | 'tier' | 'coins' | 'xp'> & { coins?: number; xp?: number }, coinBase: (v: number, i: number) => number) {
  values.forEach((v, i) => {
    const d = mk(v, i);
    const coins = d.coins ?? coinBase(v, i);
    A.push({ ...d, group, step: i, tier: tierFor(i, values.length), coins, xp: d.xp ?? Math.round(coins * 1.5) });
  });
}

const brl = (reais: number) => formatBRL(reais * 100).replace(',00', '');

/* ---- Poupança: ganho de patrimônio ---- */
const SAVE_STEPS = [10, 25, 30, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 600, 750, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000, 6000, 7500, 10000, 12500, 15000, 20000, 25000, 30000, 40000, 50000, 75000, 100000, 150000, 200000, 300000, 500000, 750000, 1000000];
chain('poupanca', SAVE_STEPS, (v) => ({
  id: `save-${v}`, name: v === 1000 ? 'Primeiro R$ 1.000 guardado' : `Primeiros ${brl(v)} economizados`,
  desc: `Aumente seu patrimônio em ${brl(v)} desde o início do jogo.`, money: true,
  progress: ({ m }) => [m.peakGain, v * 100],
}), (v) => Math.round(Math.min(4000, 10 + Math.sqrt(v) * 4)));

/* ---- Patrimônio líquido ---- */
const NW_STEPS = [0, 100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2000000, 5000000];
chain('patrimonio', NW_STEPS, (v) => ({
  id: `nw-${v}`, name: v === 0 ? 'Saí do vermelho!' : `Patrimônio líquido de ${brl(v)}`,
  desc: v === 0 ? 'Patrimônio líquido deixou de ser negativo.' : `Alcance ${brl(v)} de patrimônio líquido (ativos - dívidas).`, money: true,
  progress: ({ m }) => (v === 0 ? [m.peakNetWorth >= 0 && m.baselineNetWorth < 0 ? 1 : 0, 1] : [m.peakNetWorth, v * 100]),
  coinsFor: ({ m }) => (m.baselineNetWorth >= v * 100 ? 0 : -1),
}), (v) => Math.round(Math.min(3000, 30 + Math.sqrt(v) * 3)));

/* ---- Dívidas ---- */
chain('dividas', [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000], (v) => ({
  id: `debt-red-${v}`, name: `${brl(v)} de dívida reduzida`, desc: `Diminua em ${brl(v)} o valor das dívidas que você já tinha.`, money: true,
  progress: ({ m }) => [m.debtReduction, v * 100],
}), (v) => Math.round(Math.min(3000, 20 + Math.sqrt(v) * 5)));
chain('dividas', [1, 2, 3, 5, 10], (v) => ({
  id: `debt-off-${v}`, name: v === 1 ? 'Primeira dívida quitada' : `${v} dívidas quitadas`, desc: 'Leve uma dívida que já existia a zero.',
  progress: ({ m }) => [m.debtsPaidOff, v],
}), (v) => 120 * v);
chain('dividas', [1, 3, 5, 10, 20], (v) => ({
  id: `prepay-${v}`, name: v === 1 ? 'Primeira parcela antecipada' : `${v} parcelas antecipadas`, desc: 'Pague uma parcela antes do vencimento.',
  progress: ({ m }) => [m.installmentsPrepaid, v],
}), (v) => 30 + v * 15);
chain('dividas', [1, 5, 10, 25, 50, 100], (v) => ({
  id: `inst-${v}`, name: v === 1 ? 'Primeira parcela paga' : `${v} parcelas pagas`, desc: 'Registre o pagamento de parcelas de dívidas.',
  progress: ({ m }) => [m.installmentsPaid, v],
}), (v) => 10 + v * 4);

/* ---- Constância ---- */
chain('constancia', [1, 3, 7, 14, 21, 30, 45, 60, 90, 120, 180, 250, 365, 500, 730], (v) => ({
  id: `days-${v}`, name: v === 1 ? 'Primeiro registro' : v === 7 ? 'Sete dias registrando movimentações' : `${v} dias com registros`,
  desc: `Registre movimentações em ${v} dia(s) diferentes (não precisam ser seguidos).`, progress: ({ m }) => [m.activityDays, v],
}), (v) => 5 + Math.round(v * 1.5));
chain('constancia', [3, 7, 14, 30, 60, 100, 180, 365], (v) => ({
  id: `streak-${v}`, name: `Sequência de ${v} dias`, desc: `Mantenha uma sequência de ${v} dias (1 dia de folga não quebra).`,
  progress: ({ m }) => [m.bestStreak, v],
}), (v) => 10 + v * 2);
chain('constancia', [4, 12, 26, 52], (v) => ({
  id: `weeks-${v}`, name: `${v} semanas ativas`, desc: `Registre algo em ${v} semanas diferentes.`, progress: ({ m }) => [m.activeWeeks, v],
}), (v) => 20 + v * 5);

/* ---- Organização ---- */
chain('organizacao', [1, 10, 25, 50, 100, 250, 500, 1000, 2500], (v) => ({
  id: `tx-${v}`, name: v === 1 ? 'Primeiro lançamento' : `${v} lançamentos`, desc: `Registre ${v} lançamentos confirmados.`, progress: ({ m }) => [m.txCount, v],
}), (v) => 5 + Math.round(Math.sqrt(v) * 5));
chain('organizacao', [1, 2, 3, 5], (v) => ({ id: `acc-${v}`, name: v === 1 ? 'Primeira conta cadastrada' : `${v} contas cadastradas`, desc: 'Cadastre suas contas (sem dados bancários sensíveis).', progress: ({ m }) => [m.accountsCount, v] }), (v) => 10 + v * 5);
chain('organizacao', [1, 3, 5], (v) => ({ id: `cat-${v}`, name: `${v} categoria(s) personalizada(s)`, desc: 'Crie categorias do seu jeito.', progress: ({ m }) => [m.customCategories, v] }), (v) => 10 + v * 3);
chain('organizacao', [1, 3, 5, 10], (v) => ({ id: `rec-${v}`, name: v === 1 ? 'Primeira conta recorrente' : `${v} recorrências cadastradas`, desc: 'Cadastre assinaturas e contas fixas.', progress: ({ m }) => [m.recurringCount, v] }), (v) => 10 + v * 4);
A.push({ id: 'backup-1', group: 'organizacao', step: 10, tier: 2, coins: 30, xp: 40, name: 'Precavido', desc: 'Faça um backup dos seus dados.', progress: ({ m }) => [m.visits['backup'] ? 1 : 0, 1] });
A.push({ id: 'calendar-1', group: 'organizacao', step: 11, tier: 1, coins: 10, xp: 15, name: 'De olho no calendário', desc: 'Abra o calendário de pagamentos.', progress: ({ m }) => [m.visits['calendario'] ? 1 : 0, 1] });
A.push({ id: 'stats-1', group: 'organizacao', step: 12, tier: 1, coins: 10, xp: 15, name: 'Analista', desc: 'Abra as estatísticas.', progress: ({ m }) => [m.visits['estatisticas'] ? 1 : 0, 1] });
A.push({ id: 'csv-1', group: 'organizacao', step: 13, tier: 2, coins: 20, xp: 25, name: 'Planilheiro', desc: 'Exporte seus lançamentos em CSV.', progress: ({ m }) => [m.visits['csv-export'] ? 1 : 0, 1] });

/* ---- Meses ---- */
chain('meses', [1, 2, 3, 6, 12, 24], (v) => ({ id: `posm-${v}`, name: v === 1 ? 'Primeiro mês com saldo positivo' : `${v} meses no azul`, desc: 'Feche meses com receitas maiores que despesas.', progress: ({ m }) => [m.positiveMonths, v] }), (v) => 40 + v * 20);
chain('meses', [2, 3, 6, 12], (v) => ({ id: `posstreak-${v}`, name: `${v} meses seguidos no azul`, desc: 'Meses positivos consecutivos.', progress: ({ m }) => [m.bestPositiveStreak, v] }), (v) => 60 + v * 25);
chain('meses', [1, 3, 6, 12], (v) => ({ id: `budget-${v}`, name: v === 3 ? 'Três meses cumprindo orçamento' : `${v} mês(es) dentro do orçamento`, desc: 'Feche o mês sem estourar nenhum orçamento de categoria.', progress: ({ m }) => [m.budgetMonths, v] }), (v) => 50 + v * 25);
chain('meses', [1, 3, 6, 12], (v) => ({ id: `bills-${v}`, name: v === 1 ? 'Todas as contas do mês pagas' : `${v} meses com todas as contas pagas`, desc: 'Confirme todas as contas fixas e parcelas do mês.', progress: ({ m }) => [m.billsMonths, v] }), (v) => 40 + v * 20);
chain('meses', [100, 500, 1000, 5000], (v) => ({ id: `bestmonth-${v}`, name: `Mês com sobra de ${brl(v)}`, desc: `Feche um mês com resultado de pelo menos ${brl(v)}.`, money: true, progress: ({ m }) => [m.bestMonthResult, v * 100] }), (v) => 30 + Math.round(Math.sqrt(v) * 3));
chain('meses', [1, 3, 6], (v) => ({ id: `lowerexp-${v}`, name: `Gastou menos que no mês anterior (${v}x)`, desc: 'Reduza as despesas em relação ao mês anterior.', progress: ({ m }) => [m.lowerExpenseMonths, v] }), (v) => 30 + v * 15);

/* ---- Metas ---- */
chain('metas', [1, 3, 5], (v) => ({ id: `goal-new-${v}`, name: v === 1 ? 'Primeira meta criada' : `${v} metas criadas`, desc: 'Defina metas de economia.', progress: ({ m }) => [m.goalsCreated, v] }), (v) => 10 + v * 5);
chain('metas', [1, 2, 3, 5, 10], (v) => ({ id: `goal-done-${v}`, name: v === 1 ? 'Primeira meta concluída' : `${v} metas concluídas`, desc: 'Alcance o valor de uma meta.', progress: ({ m }) => [m.goalsCompleted, v] }), (v) => 80 * v);
chain('metas', [1, 100, 500, 1000, 5000, 10000, 20000], (v) => ({
  id: `reserve-${v}`, name: v === 1 ? 'Reserva de emergência iniciada' : `Reserva de emergência de ${brl(v)}`,
  desc: v === 1 ? 'Coloque qualquer valor numa conta do tipo Reserva.' : `Acumule ${brl(v)} em contas do tipo Reserva.`, money: v > 1,
  progress: ({ m }) => [m.reservePeak, v === 1 ? 1 : v * 100],
}), (v) => (v === 1 ? 40 : Math.round(30 + Math.sqrt(v) * 5)));
chain('metas', [100, 1000, 10000, 50000], (v) => ({ id: `guard-${v}`, name: `${brl(v)} guardados`, desc: `Tenha ${brl(v)} em poupança, reserva ou investimentos.`, money: true, progress: ({ m }) => [m.guardedPeak, v * 100] }), (v) => Math.round(20 + Math.sqrt(v) * 3));

/* ---- Decoração ---- */
chain('decoracao', [1, 5, 10, 25, 50, 100, 200, 300, 500], (v) => ({ id: `buy-${v}`, name: v === 1 ? 'Primeira compra na loja' : `${v} compras na loja`, desc: 'Compre móveis com moedas virtuais (nunca com dinheiro real).', progress: ({ m }) => [m.itemsBought, v] }), (v) => 5 + Math.round(Math.sqrt(v) * 4));
chain('decoracao', [10, 25, 50, 100, 150, 200, 300], (v) => ({ id: `distinct-${v}`, name: `${v} móveis diferentes`, desc: 'Tenha móveis diferentes no inventário.', progress: ({ m }) => [m.distinctItems, v] }), (v) => 20 + v);
chain('decoracao', [5, 10, 20, 40, 60], (v) => ({ id: `placed-${v}`, name: `${v} móveis no ambiente`, desc: 'Tenha muitos móveis posicionados no imóvel atual.', progress: ({ m }) => [m.itemsPlaced, v] }), (v) => 10 + v * 2);
chain('decoracao', [1, 3, 10], (v) => ({ id: `style-${v}`, name: v === 1 ? 'Reforma iniciada' : `${v} pisos/paredes comprados`, desc: 'Troque piso ou papel de parede.', progress: ({ m }) => [m.stylesBought, v] }), (v) => 15 + v * 5);
chain('decoracao', [1, 3], (v) => ({ id: `layout-${v}`, name: `${v} layout(s) salvo(s)`, desc: 'Salve layouts de decoração.', progress: ({ m }) => [m.layoutsSaved, v] }), (v) => 10 + v * 5);

/* ---- Imóveis ---- */
chain('imoveis', [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], (v) => ({ id: `prop-${v}`, name: `${v} imóveis conquistados`, desc: 'Desbloqueie novos imóveis.', progress: ({ m }) => [m.propertiesOwned, v] }), (v) => 50 * v);
chain('imoveis', [1, 3, 5, 10], (v) => ({ id: `exp-${v}`, name: `${v} expansão(ões)`, desc: 'Expanda seus ambientes.', progress: ({ m }) => [m.expansions, v] }), (v) => 20 + v * 10);

/* ---- Nível (só moedas, para não ser circular) ---- */
chain('nivel', [2, 3, 5, 7, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100], (v) => ({ id: `lvl-${v}`, name: `Nível ${v}`, desc: `Alcance o nível ${v}.`, noXp: true, xp: 0, progress: ({ level }) => [level, v] }), (v) => 10 + v * 8);

/* ---- Coleções ---- */
COLLECTIONS.forEach((c, i) => A.push({
  id: `col-${c.id}`, group: 'colecoes', step: i, tier: Math.min(6, 2 + Math.floor(i / 2)), coins: c.bonusCoins, xp: Math.round(c.bonusCoins * 0.8),
  name: c.name, desc: `${c.desc} Tenha todos os itens da coleção.`,
  progress: ({ owned }) => { const items = collectionItems(c.id); return [items.filter((it) => owned.has(it.id)).length, items.length]; },
}));

/* ---- Personagem ---- */
A.push({ id: 'avatar-1', group: 'personagem', step: 0, tier: 1, coins: 15, xp: 20, name: 'Cara nova', desc: 'Personalize seu personagem.', progress: ({ m }) => [m.avatarCustomized ? 1 : 0, 1] });
chain('personagem', [1, 3, 5], (v) => ({ id: `cosm-${v}`, name: `${v} acessório(s) premium`, desc: 'Compre acessórios de visual.', progress: ({ m }) => [m.cosmeticsBought, v] }), (v) => 20 + v * 10);

export const ACHIEVEMENTS = A;
export const ACH_BY_ID: Record<string, AchDef> = Object.fromEntries(A.map((a) => [a.id, a]));

export const TIER_NAMES = ['', 'Comum', 'Incomum', 'Raro', 'Épico', 'Lendário', 'Mítico'];
export const TIER_COLORS = ['', '#c9d1d9', '#4ade80', '#60a5fa', '#c084fc', '#fbbf24', '#f472b6'];
