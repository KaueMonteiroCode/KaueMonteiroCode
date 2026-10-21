import { todayISO } from '../core/dates';

/** Títulos desbloqueáveis (por nível ou conquista) */
export interface TitleDef { id: string; name: string; level?: number; ach?: string }
export const TITLES: TitleDef[] = [
  { id: 't-colchao', name: 'Morador do Colchão', level: 1 },
  { id: 't-cofrinho', name: 'Dono do Cofrinho', level: 3 },
  { id: 't-poupador', name: 'Poupador Iniciante', level: 5 },
  { id: 't-organizado', name: 'Organizado(a)', level: 7 },
  { id: 't-estrategista', name: 'Estrategista Financeiro', level: 10 },
  { id: 't-investidor', name: 'Investidor(a) em Formação', level: 14 },
  { id: 't-empreendedor', name: 'Empreendedor(a)', level: 18 },
  { id: 't-executivo', name: 'Executivo(a)', level: 22 },
  { id: 't-diretor', name: 'Diretor(a)', level: 27 },
  { id: 't-ceo', name: 'CEO', level: 32 },
  { id: 't-magnata', name: 'Magnata', level: 40 },
  { id: 't-imperador', name: 'Imperador(a) Financeiro(a)', level: 50 },
  { id: 't-quitador', name: 'Exterminador de Dívidas', ach: 'debt-off-1' },
  { id: 't-reserva', name: 'Guardião da Reserva', ach: 'reserve-1000' },
  { id: 't-mil', name: 'Clube do Primeiro Mil', ach: 'save-1000' },
  { id: 't-constante', name: 'Constante como o Sol', ach: 'days-30' },
  { id: 't-azul', name: 'Sempre no Azul', ach: 'posstreak-3' },
  { id: 't-orcamento', name: 'Mestre do Orçamento', ach: 'budget-3' },
  { id: 't-gamer', name: 'Gamer de Respeito', ach: 'col-gamer' },
  { id: 't-colecionador', name: 'Colecionador(a)', ach: 'distinct-50' },
  { id: 't-milionario', name: 'Milionário(a) (de verdade!)', ach: 'nw-1000000' },
];

/** Eventos especiais sazonais (todo ano). Ativam missões e itens exclusivos. */
export interface EventDef { id: string; name: string; desc: string; from: string; to: string; color: string; bonusMission: { name: string; desc: string; coins: number } }
export const EVENTS: EventDef[] = [
  { id: 'ev-janeiro', name: 'Janeiro Planejado', desc: 'Comece o ano com orçamento definido.', from: '01-01', to: '01-31', color: '#60a5fa', bonusMission: { name: 'Orçamento do ano', desc: 'Defina pelo menos 3 limites de orçamento.', coins: 60 } },
  { id: 'ev-consumidor', name: 'Semana do Consumidor Consciente', desc: 'Compare antes de comprar.', from: '03-10', to: '03-20', color: '#f472b6', bonusMission: { name: 'Consumo consciente', desc: 'Registre 5 despesas com categoria nesta semana.', coins: 40 } },
  { id: 'ev-cofrinho', name: 'Outubro do Cofrinho', desc: 'Mês da poupança: toda economia conta.', from: '10-01', to: '10-31', color: '#4ade80', bonusMission: { name: 'Cofrinho cheio', desc: 'Aumente seu patrimônio em R$ 50 neste mês.', coins: 80 } },
  { id: 'ev-blackfriday', name: 'Black Friday Consciente', desc: 'O melhor desconto é não comprar parcelado.', from: '11-15', to: '11-30', color: '#fbbf24', bonusMission: { name: 'Sem parcelas novas', desc: 'Passe o evento sem novas compras parceladas (precisa registrar algo).', coins: 70 } },
  { id: 'ev-dezembro', name: '13º Inteligente', desc: 'Guarde parte do 13º antes de gastar.', from: '12-01', to: '12-31', color: '#c084fc', bonusMission: { name: 'Guardar o 13º', desc: 'Transfira dinheiro para reserva ou investimento neste mês.', coins: 80 } },
];

export function activeEvents(today = todayISO()): EventDef[] {
  const md = today.slice(5);
  return EVENTS.filter((e) => md >= e.from && md <= e.to);
}
