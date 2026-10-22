import type { Cents } from '../core/money';
import type { ISODate } from '../core/dates';

export const SAVE_VERSION = 1;

/* ===================== FINANÇAS (dinheiro real) ===================== */

export type AccountType =
  | 'checking' // conta corrente
  | 'savings' // poupança
  | 'cash' // dinheiro em espécie / carteira
  | 'investment' // investimentos
  | 'reserve' // reserva de emergência / cofrinho
  | 'credit_card' // cartão de crédito (passivo)
  | 'debt'; // dívida / empréstimo / financiamento (passivo)

export const LIABILITY_TYPES: AccountType[] = ['credit_card', 'debt'];
export const isLiability = (t: AccountType) => LIABILITY_TYPES.includes(t);

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  /**
   * Saldo inicial ASSINADO em centavos. Ativos positivos; passivos (valor devido) negativos.
   * O saldo inicial é a "linha de base" e NUNCA gera recompensas.
   */
  initialBalance: Cents;
  /** Data a partir da qual o saldo inicial vale. */
  openedAt: ISODate;
  color: string;
  archived?: boolean;
  /** Cartão de crédito */
  creditLimit?: Cents;
  closingDay?: number;
  dueDay?: number;
  /** Dívida: plano de parcelas */
  debt?: DebtPlan;
  createdAt: number;
}

export interface DebtPlan {
  installmentAmount: Cents; // valor de cada parcela
  installmentsTotal: number; // total de parcelas do contrato
  firstDueDate: ISODate; // vencimento da primeira parcela do plano
  creditor?: string;
  interestNote?: string;
}

export type TxKind =
  | 'income' // receita (salário, freela...)
  | 'expense' // despesa
  | 'transfer' // transferência entre contas (inclui pagamento de fatura/dívida e empréstimo recebido)
  | 'adjustment'; // correção de saldo (reconciliação)

export type TxStatus = 'confirmed' | 'pending';

export interface Transaction {
  id: string;
  kind: TxKind;
  date: ISODate;
  /** Sempre positivo. Para "adjustment" pode ser negativo. */
  amount: Cents;
  accountId: string;
  /** Destino para transferências */
  toAccountId?: string;
  categoryId?: string;
  description: string;
  status: TxStatus;
  /**
   * Economia declarada: dinheiro guardado que ainda não estava registrado (cofrinho, troco, sobra).
   * Entra no patrimônio, mas aparece separada das receitas nos relatórios.
   */
  saving?: boolean;
  /** Compra parcelada no cartão: valor total lançado no passivo, com informação das parcelas */
  installments?: { count: number; amounts: Cents[]; firstInvoice: string /* AAAA-MM */ };
  /** Origem: ocorrência de recorrência confirmada ou parcela de dívida */
  recurringId?: string;
  occurrenceDate?: ISODate;
  debtInstallment?: { debtAccountId: string; number: number; dueDate: ISODate };
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
  deletedAt?: number;
  /** Histórico de alterações (versões anteriores) */
  history?: { at: number; action: 'edit' | 'delete' | 'restore'; before: Omit<Transaction, 'history'> }[];
}

export interface Category {
  id: string;
  name: string;
  kind: 'income' | 'expense';
  color: string;
  icon: string; // id de ícone pixel
  system?: boolean;
}

export interface RecurringRule {
  id: string;
  name: string;
  kind: 'income' | 'expense';
  amount: Cents;
  accountId: string;
  categoryId?: string;
  frequency: 'monthly' | 'weekly' | 'yearly';
  /** dia do mês (mensal/anual) */
  day: number;
  startDate: ISODate;
  endDate?: ISODate;
  isSubscription: boolean;
  active: boolean;
  createdAt: number;
}

export interface Goal {
  id: string;
  name: string;
  target: Cents;
  /** Conta vinculada: o progresso é o saldo dessa conta. Sem conta = patrimônio líquido. */
  accountId?: string;
  deadline?: ISODate;
  isEmergency?: boolean;
  createdAt: number;
  archived?: boolean;
}

export interface Budget {
  categoryId: string;
  limit: Cents;
}

export interface AuditEntry {
  at: number;
  action: string;
  detail: string;
}

export interface FinanceState {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurring: RecurringRule[];
  goals: Goal[];
  budgets: Budget[];
  audit: AuditEntry[];
}

/* ===================== JOGO (economia virtual) ===================== */

export interface AvatarConfig {
  skin: number;
  hairStyle: number;
  hairColor: number;
  eyes: number;
  mouth: number;
  shirtStyle: number;
  shirtColor: number;
  pantsStyle: number;
  pantsColor: number;
  shoesColor: number;
  accessory: number; // 0 = nenhum
  beard: number;
}

export interface Placement {
  propertyId: string;
  x: number;
  y: number;
  rot: number; // 0..3 (itens de parede: 0 = parede esquerda, 1 = parede direita)
}

export interface OwnedItem {
  uid: number;
  defId: string;
  placed: Placement | null;
  acquiredAt: number;
  /** Itens fixos do imóvel não podem ser movidos nem vendidos */
  locked?: boolean;
  /** Presente do imóvel: pode mover/guardar, mas não vender (evita gerar moedas do nada) */
  gift?: boolean;
}

export interface CoinEntry {
  id: string;
  at: number;
  amount: number; // + ganho, - gasto
  reason: string;
  kind: 'buy' | 'sell' | 'property' | 'expansion' | 'cosmetic' | 'style' | 'claim';
  ref?: string;
}

export interface SavedLayout {
  id: string;
  name: string;
  createdAt: number;
  floor: string;
  wall: string;
  items: { defId: string; x: number; y: number; rot: number }[];
}

export interface RoomState {
  floor: string; // id do estilo de piso
  wall: string; // id do estilo de parede
  light: string; // tema de iluminação
  expansion: number; // nível de expansão
  layouts: SavedLayout[];
}

export interface Claim {
  at: number;
  coins: number;
  xp: number;
  label: string;
}

export interface GameState {
  inventory: OwnedItem[];
  nextUid: number;
  coinLedger: CoinEntry[];
  ownedProperties: string[];
  currentProperty: string;
  rooms: Record<string, RoomState>;
  ownedStyles: string[];
  ownedCosmetics: string[];
  /** Dias (relógio real) em que o jogador registrou algo. Não pode ser "retroativo". */
  activityDays: ISODate[];
  claims: Record<string, Claim>;
  /** Primeira vez que cada conquista foi vista (para notificações) */
  seenAchievements: Record<string, number>;
  seenLevel: number;
  visits: Record<string, number>; // telas visitadas (missões de hábito)
  /** Lista de desejos: ids de móveis que o jogador quer comprar */
  wishlist: string[];
}

export interface Profile {
  name: string;
  avatar: AvatarConfig;
  titleId: string | null;
  onboarded: boolean;
  onboardingStep: number;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  reduceMotion: boolean;
  showGrid: boolean;
}

export interface SaveData {
  version: number;
  savedAt: number;
  createdAt: number;
  profile: Profile;
  settings: Settings;
  finance: FinanceState;
  game: GameState;
}
