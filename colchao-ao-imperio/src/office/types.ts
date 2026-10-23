/**
 * Contrato do Escritório: cada robô/projeto manda "boletins" (AgentReport) para o servidor,
 * que guarda o último de cada um e um histórico curto de acontecimentos.
 * O mesmo formato vale para o servidor local (seu PC) e para um servidor online no futuro.
 */
export type AgentStatus = 'working' | 'idle' | 'done' | 'error';
export type AgentIcon = 'cart' | 'video' | 'gift' | 'money' | 'search' | 'chart' | 'bot' | 'channel';

export interface AgentConfig {
  id: string;            // usado nos boletins: "alfredo"
  name: string;          // "Alfredo"
  project: string;       // "Buscas ML / Shopee"
  role?: string;         // frase curta do que ele faz
  color: string;         // cor do setup (#e2b53f)
  icon: AgentIcon;
  /** minutos sem boletim até ser considerado "sem notícias" */
  staleMin?: number;
  avatar?: { skin?: number; hairStyle?: number; hairColor?: number; accessory?: number; beard?: number; shirtStyle?: number };
}

export interface AgentTask { name: string; progress?: number }

export interface AgentReport {
  agent: string;
  status?: AgentStatus;
  task?: string;          // "Pesquisando ofertas de fones"
  detail?: string;        // "nicho: eletrônicos"
  progress?: number;      // 0-100
  tasks?: AgentTask[];
  event?: string;         // acontecimento para o mural: "Encontrou 12 ofertas"
  error?: string;
  metrics?: Record<string, number | string>;
  ts: number;
}

export interface AgentEvent { agent: string; ts: number; text: string; kind: 'info' | 'done' | 'error' }

export interface OfficeState {
  title: string;
  boss: string;
  agents: AgentConfig[];
  latest: Record<string, AgentReport>;
  events: AgentEvent[];
  viewers: string[];
  ai: boolean;
  now: number;
}

export type Live = 'live' | 'demo' | 'offline';
