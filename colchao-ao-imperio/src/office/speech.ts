import type { AgentConfig, AgentReport } from './types';

export type ViewState = 'working' | 'idle' | 'done' | 'error' | 'offline' | 'never';

export function viewState(a: AgentConfig, r: AgentReport | undefined, now: number): ViewState {
  if (!r) return 'never';
  if (now - r.ts > (a.staleMin ?? 60) * 60_000) return 'offline';
  if (r.status === 'done' && now - r.ts > 10 * 60_000) return 'idle';
  return r.status ?? 'working';
}

export const STATE_LABEL: Record<ViewState, string> = {
  working: 'Trabalhando', idle: 'Parado', done: 'Concluiu', error: 'Com erro', offline: 'Sem notícias', never: 'Aguardando 1º boletim',
};
export const STATE_COLOR: Record<ViewState, string> = {
  working: '#4ade80', idle: '#9187a3', done: '#ffd34d', error: '#ff6b6b', offline: '#7c8191', never: '#7c8191',
};

export function ago(ts: number, now: number) {
  const m = Math.max(0, Math.round((now - ts) / 60_000));
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 48) return `há ${h} h`;
  return `há ${Math.round(h / 24)} dias`;
}

function greet(now: number) {
  const h = new Date(now).getHours();
  return h < 5 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Fala do robô montada só com o que ele relatou (sem inventar números). */
export function speech(a: AgentConfig, r: AgentReport | undefined, now: number, boss: string): string {
  const chefe = boss ? `chefe ${boss.split(' ')[0]}` : 'chefe';
  const st = viewState(a, r, now);
  const hi = `${greet(now)}, ${chefe}!`;
  if (st === 'never') return `${hi} Sou o ${a.name}, do ${a.project}. Ainda não recebi nenhum boletim do meu robô — quando ele mandar o primeiro, eu te conto tudo por aqui.`;
  const rep = r!;
  const what = rep.task ? `Atualmente estou ${lower(rep.task)}${rep.detail ? ` (${rep.detail})` : ''}.` : '';
  const last = rep.event ? ` Última novidade: ${lower(rep.event)}.` : '';
  switch (st) {
    case 'offline': return `Zzz... ${chefe}, faz tempo que não recebo notícias do meu robô (último boletim ${ago(rep.ts, now)}). Pode ser que ele tenha parado — vale dar uma olhada no PC.`;
    case 'error': return `${chefe.charAt(0).toUpperCase() + chefe.slice(1)}, deu ruim aqui: ${rep.error ?? 'o robô relatou um erro'}. ${what} Preciso que você dê uma olhada.`;
    case 'done': return `${hi} Terminei${rep.task ? `: ${lower(rep.task)}` : ' o que estava fazendo'}.${last} Qualquer coisa me chama!`;
    case 'idle': return `${hi} Estou de boa agora, esperando a próxima rodada.${last} Qualquer coisa me chama!`;
    default: return `${hi} ${what}${last} Qualquer coisa me chama!`;
  }
}
