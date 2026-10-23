/**
 * Conexão com o servidor do Escritório (office-server/server.mjs).
 * Sem servidor (arquivo aberto direto, link de prévia), roda um modo DEMONSTRAÇÃO
 * com dados fictícios claramente marcados.
 */
import { DEFAULT_AGENTS } from './defaults';
import type { AgentEvent, AgentReport, Live, OfficeState } from './types';

const qs = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
function token() {
  const k = qs.get('k');
  try { if (k) localStorage.setItem('office-k', k); return k ?? localStorage.getItem('office-k') ?? ''; } catch { return k ?? ''; }
}
const api = (path: string) => {
  const k = token();
  return `${path}${k ? (path.includes('?') ? '&' : '?') + 'k=' + encodeURIComponent(k) : ''}`;
};
const canTryServer = typeof location !== 'undefined' && /^https?:$/.test(location.protocol) && !/claude\.ai|claudeusercontent/.test(location.hostname);

export interface Feed { stop(): void; chat(agent: string, message: string): Promise<{ reply: string; ai: boolean }> }

export function connectFeed(viewer: string, onState: (s: OfficeState, live: Live) => void): Feed {
  let stopped = false;
  let es: EventSource | null = null;
  let demo: Feed | null = null;
  const startDemo = () => { if (!stopped && !demo) demo = demoFeed(onState); };
  if (!canTryServer) startDemo();
  else {
    fetch(api('/api/state')).then((r) => (r.ok ? r.json() : Promise.reject(r.status))).then((s: OfficeState) => {
      if (stopped) return;
      onState(s, 'live');
      const open = () => {
        es = new EventSource(api(`/api/stream?nome=${encodeURIComponent(viewer)}`));
        es.onmessage = (m) => { try { onState(JSON.parse(m.data), 'live'); } catch { /* ignora */ } };
        es.onerror = () => { if (stopped) return; onState(s, 'offline'); };
      };
      open();
    }).catch(startDemo);
  }
  return {
    stop() { stopped = true; es?.close(); demo?.stop(); },
    async chat(agent, message) {
      if (demo) return demo.chat(agent, message);
      const r = await fetch(api('/api/chat'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent, message }) });
      if (!r.ok) throw new Error((await r.text()) || `erro ${r.status}`);
      return r.json();
    },
  };
}

/* ---------------- modo demonstração ---------------- */

function demoFeed(onState: (s: OfficeState, live: Live) => void): Feed {
  const now = () => Date.now();
  const latest: Record<string, AgentReport> = {};
  const events: AgentEvent[] = [];
  const t0 = now();
  const niches = ['eletrônicos', 'fones bluetooth', 'acessórios para casa', 'air fryer', 'smartwatch'];
  let tick = 0;
  const step = () => {
    tick++;
    const n = niches[Math.floor(tick / 3) % niches.length];
    const pAl = (tick * 9) % 100;
    latest.alfredo = { agent: 'alfredo', status: 'working', task: `Pesquisando ofertas no Mercado Livre`, detail: `nicho: ${n}`, progress: pAl,
      tasks: [{ name: 'Pesquisa de ofertas (ML)', progress: pAl }, { name: 'Comparar preços', progress: Math.max(0, pAl - 25) }, { name: 'Separar melhores ofertas', progress: Math.max(0, pAl - 45) }],
      event: tick % 3 === 0 ? `Encontrou ${3 + (tick % 9)} ofertas de ${n}` : latest.alfredo?.event, metrics: { 'ofertas hoje': 12 + tick }, ts: now() };
    const vid = 1 + (Math.floor(tick / 4) % 5);
    const pT = (tick * 13) % 100;
    latest.teo = { agent: 'teo', status: pT > 88 ? 'done' : 'working', task: `Renderizando vídeo ${vid} de 5`, progress: pT,
      tasks: [{ name: 'Roteiro', progress: 100 }, { name: 'Narração', progress: Math.min(100, pT + 30) }, { name: 'Render', progress: pT }],
      event: pT > 88 ? `Vídeo ${vid} pronto e agendado` : latest.teo?.event, metrics: { 'vídeos hoje': `${vid - 1}/5` }, ts: now() };
    latest.bia = { agent: 'bia', status: tick % 11 === 7 ? 'error' : 'working', task: 'Atualizando o painel de promoções', progress: (tick * 7) % 100,
      error: tick % 11 === 7 ? 'site da loja demorou para responder (timeout)' : undefined, event: 'Publicou 4 promoções no painel', metrics: { 'promos ativas': 31 }, ts: now() };
    latest.nando = { agent: 'nando', status: 'idle', task: 'Conferindo o resumo do mês', event: 'Patrimônio atualizado no jogo', ts: t0 - 30 * 60_000 };
    for (const id of ['alfredo', 'teo', 'bia']) {
      const r = latest[id];
      if (r.event && (r.status === 'done' || r.status === 'error' || tick % 3 === 0)) {
        const text = r.status === 'error' ? `Erro: ${r.error}` : r.event;
        if (events[0]?.text !== text) events.unshift({ agent: id, ts: now(), text, kind: r.status === 'error' ? 'error' : r.status === 'done' ? 'done' : 'info' });
      }
    }
    events.splice(40);
    onState({ title: 'Escritório', boss: '', agents: DEFAULT_AGENTS, latest: { ...latest }, events: [...events], viewers: ['você (demonstração)'], ai: false, now: now() }, 'demo');
  };
  step();
  const iv = setInterval(step, 5000);
  return {
    stop() { clearInterval(iv); },
    async chat(agent) {
      await new Promise((r) => setTimeout(r, 500));
      const a = DEFAULT_AGENTS.find((x) => x.id === agent);
      return { reply: `Isto é uma demonstração, chefe. Quando o servidor do escritório estiver rodando no seu PC (com a chave da IA configurada), eu ${a ? `— o ${a.name} — ` : ''}respondo com base nos boletins reais do meu robô.`, ai: false };
    },
  };
}
