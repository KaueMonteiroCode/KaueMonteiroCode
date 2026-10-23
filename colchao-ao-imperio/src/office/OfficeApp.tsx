import { useEffect, useMemo, useRef, useState } from 'react';
import { GameEngine, type AgentState } from '../engine/engine';
import { renderAvatarPreview } from '../engine/avatar';
import { agentAvatar as buildAvatar, buildOffice } from './layout';
import { connectFeed, type Feed } from './feed';
import { ago, speech, STATE_COLOR, STATE_LABEL, viewState, type ViewState } from './speech';
import type { AgentConfig, AgentIcon, Live, OfficeState } from './types';

const ICON: Record<AgentIcon, string> = { cart: '🛒', video: '🎬', gift: '🎁', money: '💰', search: '🔍', chart: '📊', bot: '🤖', channel: '📺' };
const ENGINE_STATE: Record<ViewState, AgentState> = { working: 'working', idle: 'idle', done: 'done', error: 'error', offline: 'offline', never: 'idle' };

function loadName() { try { return localStorage.getItem('office-nome') || ''; } catch { return ''; } }

export function OfficeApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const feedRef = useRef<Feed | null>(null);
  const tagRefs = useRef(new Map<string, HTMLButtonElement>());
  const seenEvent = useRef(0);
  const [state, setState] = useState<OfficeState | null>(null);
  const [live, setLive] = useState<Live>('demo');
  const [sel, setSel] = useState<string | null>(null);
  const [name, setName] = useState(loadName);
  const [help, setHelp] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [narrow, setNarrow] = useState(() => window.innerWidth < 760);

  // conexão com o servidor (ou demonstração)
  useEffect(() => {
    const f = connectFeed(name || 'Chefe', (s, l) => { setState(s); setLive(l); });
    feedRef.current = f;
    return () => f.stop();
  }, [name]);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 15_000);
    const onR = () => setNarrow(window.innerWidth < 760);
    window.addEventListener('resize', onR);
    return () => { clearInterval(iv); window.removeEventListener('resize', onR); };
  }, []);

  const agents = state?.agents ?? [];
  const boss = name || state?.boss || '';
  const layoutKey = agents.map((a) => `${a.id}:${a.color}:${a.name}`).join('|');

  // monta o escritório quando a lista de robôs muda
  useEffect(() => {
    if (!canvasRef.current || !agents.length) return;
    let e = engineRef.current;
    if (!e) {
      e = new GameEngine(canvasRef.current);
      e.office = true;
      engineRef.current = e;
    }
    const b = buildOffice(agents, boss || 'Chefe');
    e.save = null; e.staticKey = ''; // força reconstrução completa do ambiente
    e.setSave(b.save);
    e.setAgents(b.specs);
    e.fit(true);
    e.cb.onActorClick = (id) => setSel(id);
    seenEvent.current = Date.now() - 1000;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  useEffect(() => () => { engineRef.current?.destroy(); engineRef.current = null; }, []);

  // estados dos robôs -> animação dos NPCs
  useEffect(() => {
    const e = engineRef.current;
    if (!e || !state) return;
    const t = Date.now();
    for (const a of state.agents) e.setAgentState(a.id, ENGINE_STATE[viewState(a, state.latest[a.id], t)]);
    const fresh = state.events.filter((ev) => ev.ts > seenEvent.current).reverse();
    for (const ev of fresh) {
      if (ev.kind === 'done') e.agentCelebrate(ev.agent, '🎉 Pronto!');
      else if (ev.kind === 'info') e.setAgentState(ev.agent, ENGINE_STATE[viewState(state.agents.find((a) => a.id === ev.agent)!, state.latest[ev.agent], t)], short(ev.text));
    }
    if (state.events[0]) seenEvent.current = Math.max(seenEvent.current, state.events[0].ts);
  }, [state, now]);

  // painel aberto ocupa espaço à direita/embaixo
  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    if (sel) { e.setInset(narrow ? 0 : 380, narrow ? Math.round(window.innerHeight * 0.55) : 0); e.focusActor(sel); }
    else { e.setInset(0, 0); e.fit(); }
  }, [sel, narrow]);

  // etiquetas acompanham os NPCs
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const e = engineRef.current;
      if (e) for (const [id, el] of tagRefs.current) {
        const p = e.actorHead(id);
        if (!p) { el.style.display = 'none'; continue; }
        el.style.display = '';
        el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y - (narrowNow() ? 8 : 30))}px) translate(-50%, -100%)`;
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  const views = useMemo(() => agents.map((a) => ({ a, r: state?.latest[a.id], st: viewState(a, state?.latest[a.id], now) })), [agents, state, now]);
  const active = views.filter((v) => v.st === 'working' || v.st === 'done').length;
  const alerts = views.filter((v) => v.st === 'error' || v.st === 'offline').length;
  const selV = views.find((v) => v.a.id === sel);
  const recent = (state?.events ?? []).slice(0, 3).filter((ev) => now - ev.ts < 10 * 60_000 || live === 'demo');

  return (
    <div className="of-root">
      <canvas ref={canvasRef} className="of-canvas" />

      <div className="of-top">
        <div className="of-brand"><span className="of-crown">👑</span><div><b>{boss ? `Escritório de ${boss.split(' ')[0]}` : 'Escritório'}</b><small>{state?.title && state.title !== 'Escritório' ? state.title : 'Seus robôs trabalhando'}</small></div></div>
        <div className="of-pill"><small>{narrow ? 'Ativos' : 'Robôs ativos'}</small><b>{active}/{agents.length}</b></div>
        <div className={`of-pill ${alerts ? 'warn' : ''}`}><small>Alertas</small><b>{alerts}</b></div>
        {!narrow && <div className="of-pill"><small>Online</small><b className="of-ellipsis">{(state?.viewers ?? []).join(', ') || '—'}</b></div>}
        <div className={`of-live ${live}`}>{live === 'live' ? '● Ao vivo' : live === 'demo' ? '◐ Demonstração' : '○ Reconectando...'}</div>
        <button className="of-btn" onClick={() => setHelp(true)} aria-label="Ajuda e ajustes">⚙</button>
      </div>

      {live === 'demo' && <div className="of-banner">Modo demonstração: dados <b>fictícios</b>. Rode o servidor no seu PC para ver seus robôs de verdade. <button onClick={() => setHelp(true)}>Como?</button></div>}

      {/* etiquetas sobre cada NPC */}
      {views.map(({ a, st }) => (
        <button key={a.id} ref={(el) => { if (el) tagRefs.current.set(a.id, el); else tagRefs.current.delete(a.id); }} className={`of-tag ${sel === a.id ? 'on' : ''}`} style={{ ['--c' as string]: a.color }} onClick={() => setSel(a.id)}>
          <span className="of-ic">{ICON[a.icon] ?? '🤖'}</span>
          <span className="of-tag-t"><b>{a.name}</b><small>{a.project}</small></span>
          <i style={{ background: STATE_COLOR[st] }} title={STATE_LABEL[st]} />
        </button>
      ))}

      {!narrow && (
        <div className="of-side">
          {views.map(({ a, st, r }) => (
            <button key={a.id} className={`of-row ${sel === a.id ? 'on' : ''}`} style={{ ['--c' as string]: a.color }} onClick={() => setSel(a.id)}>
              <span className="of-ic">{ICON[a.icon] ?? '🤖'}</span>
              <span className="of-row-t"><b>{a.name}</b><small>{r?.task ?? a.project}</small></span>
              <span className="of-dot" style={{ background: STATE_COLOR[st] }} title={STATE_LABEL[st]} />
            </button>
          ))}
        </div>
      )}

      {!sel && recent.length > 0 && (
        <div className="of-feed">
          {recent.map((ev) => {
            const a = agents.find((x) => x.id === ev.agent);
            return <div key={ev.ts + ev.text} className={`of-ev ${ev.kind}`} style={{ ['--c' as string]: a?.color ?? '#888' }} onClick={() => setSel(ev.agent)}><span>{ev.kind === 'error' ? '⚠' : ev.kind === 'done' ? '✔' : '🔔'}</span><span className="grow"><b>{a?.name ?? ev.agent}</b> {ev.text}</span><small>{ago(ev.ts, now)}</small></div>;
          })}
        </div>
      )}

      {selV && <AgentCard key={selV.a.id} a={selV.a} state={state!} st={selV.st} now={now} boss={boss} feed={feedRef.current} ai={!!state?.ai} onClose={() => setSel(null)} />}
      {help && <HelpModal live={live} name={name} onName={(n) => { setName(n); try { localStorage.setItem('office-nome', n); } catch { /* sem armazenamento */ } }} onClose={() => setHelp(false)} />}
    </div>
  );
}

const narrowNow = () => window.innerWidth < 760;
const short = (s: string) => (s.length > 34 ? s.slice(0, 32) + '…' : s);

function AgentCard({ a, state, st, now, boss, feed, ai, onClose }: { a: AgentConfig; state: OfficeState; st: ViewState; now: number; boss: string; feed: Feed | null; ai: boolean; onClose: () => void }) {
  const r = state.latest[a.id];
  const cv = useRef<HTMLCanvasElement>(null);
  const [q, setQ] = useState('');
  const [chat, setChat] = useState<{ who: 'eu' | 'npc'; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const idx = state.agents.findIndex((x) => x.id === a.id);
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const b = buildAvatar(a, idx);
    const loop = () => { if (cv.current) renderAvatarPreview(cv.current, b, { dir: 0, anim: st === 'working' ? 'idle' : st === 'done' ? 'celebrate' : 'idle', t: (performance.now() - t0) / 1000 }, 2); raf = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [a, idx, st]);
  const events = state.events.filter((e) => e.agent === a.id).slice(0, 6);
  const tasks = r?.tasks?.length ? r.tasks : r?.task ? [{ name: r.task, progress: r.progress }] : [];
  const ask = async () => {
    const m = q.trim();
    if (!m || !feed) return;
    setQ(''); setBusy(true);
    setChat((c) => [...c, { who: 'eu', text: m }]);
    try { const res = await feed.chat(a.id, m); setChat((c) => [...c, { who: 'npc', text: res.reply }]); }
    catch (err) { setChat((c) => [...c, { who: 'npc', text: `Não consegui responder agora (${(err as Error).message}).` }]); }
    setBusy(false);
  };
  return (
    <div className="of-card" style={{ ['--c' as string]: a.color }}>
      <div className="of-card-h">
        <canvas ref={cv} width={84} height={120} />
        <div className="grow">
          <div className="of-card-name">{a.name} <span>{ICON[a.icon]}</span></div>
          <div className="of-card-proj">{a.project}</div>
          <div className="of-card-st" style={{ color: STATE_COLOR[st] }}>● {STATE_LABEL[st]}{r ? <small> · boletim {ago(r.ts, now)}</small> : null}</div>
        </div>
        <button className="of-btn" onClick={onClose} aria-label="Fechar">✕</button>
      </div>
      <div className="of-card-body">
        <div className="of-bubble">{speech(a, r, now, boss)}</div>
        {tasks.length > 0 && (
          <div className="of-sec"><h4>Tarefas atuais</h4>
            {tasks.map((t) => (
              <div key={t.name} className="of-task">
                <div className="of-task-l"><span>{(t.progress ?? 0) >= 100 ? '✔' : '▸'} {t.name}</span>{t.progress != null && <b>{Math.round(t.progress)}%</b>}</div>
                {t.progress != null && <div className="of-bar"><i style={{ width: `${Math.max(0, Math.min(100, t.progress))}%` }} /></div>}
              </div>
            ))}
          </div>
        )}
        {r?.metrics && Object.keys(r.metrics).length > 0 && (
          <div className="of-sec"><h4>Números</h4><div className="of-metrics">{Object.entries(r.metrics).map(([k, v]) => <div key={k}><b>{String(v)}</b><small>{k}</small></div>)}</div></div>
        )}
        {events.length > 0 && (
          <div className="of-sec"><h4>Histórico</h4>{events.map((e) => <div key={e.ts + e.text} className={`of-hist ${e.kind}`}><small>{ago(e.ts, now)}</small> {e.text}</div>)}</div>
        )}
        {a.role && <div className="of-role">{a.role}</div>}
        <div className="of-sec"><h4>Falar com {a.name}{ai ? ' (IA)' : ''}</h4>
          {chat.map((c, i) => <div key={i} className={`of-msg ${c.who}`}>{c.text}</div>)}
          <form className="of-ask" onSubmit={(e) => { e.preventDefault(); void ask(); }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Ex.: ${a.name}, qual a melhor oferta de hoje?`} maxLength={400} disabled={busy} />
            <button className="of-btn primary" disabled={busy || !q.trim()}>{busy ? '...' : 'Enviar'}</button>
          </form>
          {!ai && <div className="of-note">Sem IA ligada: ele responde com o resumo dos boletins. Veja ⚙ para ligar a IA.</div>}
        </div>
      </div>
    </div>
  );
}


function HelpModal({ live, name, onName, onClose }: { live: Live; name: string; onName: (n: string) => void; onClose: () => void }) {
  const [n, setN] = useState(name);
  const origin = /^https?:/.test(location.protocol) && live === 'live' ? location.origin : 'http://localhost:4317';
  return (
    <div className="of-modal" onClick={onClose}>
      <div className="of-modal-b" onClick={(e) => e.stopPropagation()}>
        <div className="of-card-h"><b className="grow">Ajustes e como ligar os robôs</b><button className="of-btn" onClick={onClose}>✕</button></div>
        <label>Seu nome (aparece no escritório e para quem estiver online)</label>
        <div className="of-ask"><input value={n} onChange={(e) => setN(e.target.value)} maxLength={24} placeholder="Ex.: Cauê" /><button className="of-btn primary" onClick={() => { onName(n.trim()); onClose(); }}>Salvar</button></div>
        <h4>1. Ligar o escritório no seu PC</h4>
        <p>Na pasta <code>colchao-ao-imperio</code>, dê dois cliques em <code>Abrir-Escritorio.bat</code> (ou rode <code>npm run office</code>). Ele abre <code>{origin}</code>.</p>
        <h4>2. Cada robô manda um boletim</h4>
        <p>No fim de cada etapa do robô, envie um POST. Exemplos:</p>
        <pre>{`# Python
import requests
requests.post("${origin}/api/report", json={
  "agent": "alfredo", "status": "working",
  "task": "Pesquisando ofertas de fones", "progress": 40,
  "event": "Encontrou 12 ofertas"})`}</pre>
        <pre>{`// Node.js
await fetch("${origin}/api/report", { method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ agent: "teo", status: "done", event: "Vídeo 3 pronto" }) });`}</pre>
        <pre>{`# Terminal (qualquer linguagem)
node office-server/report.mjs alfredo working "Pesquisando ofertas" --progress 40 --event "Encontrou 12 ofertas"`}</pre>
        <p><b>status</b>: working (trabalhando), idle (parado), done (terminou, ele comemora), error (com <code>"error": "motivo"</code>). Campos opcionais: <code>detail</code>, <code>tasks: [{'{'}name, progress{'}'}]</code>, <code>metrics: {'{'}"ofertas hoje": 12{'}'}</code>.</p>
        <h4>3. Robôs, nomes e cores</h4>
        <p>Edite <code>office-server/data/agents.json</code> (criado na 1ª vez). Dá para adicionar canais e novos projetos: cada um vira um NPC com mesa da cor escolhida.</p>
        <h4>4. IA nas conversas (opcional)</h4>
        <p>Defina a variável <code>ANTHROPIC_API_KEY</code> antes de abrir o servidor. Os NPCs respondem com base nos boletins reais — nunca inventam números.</p>
        <h4>5. Seu irmão acompanhando</h4>
        <p>Na mesma rede: abra com <code>HOST=0.0.0.0</code> e <code>OFFICE_TOKEN=uma-senha</code>; ele acessa <code>http://IP-do-seu-PC:4317/?k=uma-senha</code>. Depois dá para subir o mesmo servidor online.</p>
      </div>
    </div>
  );
}
