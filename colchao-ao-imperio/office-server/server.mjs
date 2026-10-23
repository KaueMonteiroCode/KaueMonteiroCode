#!/usr/bin/env node
/**
 * Servidor do Escritório dos Robôs.
 *
 * - Recebe boletins dos seus robôs:     POST /api/report   {agent, status, task, progress, event, ...}
 * - Entrega o estado para o escritório: GET  /api/state  e  GET /api/stream (ao vivo, SSE)
 * - Conversa com os NPCs (opcional):    POST /api/chat    {agent, message}  (precisa de ANTHROPIC_API_KEY)
 * - Serve a página do escritório em     http://localhost:4317
 *
 * Variáveis (todas opcionais):
 *   PORT=4317            porta
 *   HOST=127.0.0.1       use 0.0.0.0 para outras pessoas da sua rede acessarem
 *   OFFICE_TOKEN=senha   exige ?k=senha (ou Authorization: Bearer senha) em toda a API
 *   ANTHROPIC_API_KEY    liga as respostas com IA nas conversas
 *   OFFICE_DATA=pasta    onde ficam agents.json e state.json (padrão: office-server/data)
 *
 * Sem dependências além do Node 18+ (o SDK do Claude só é carregado se houver chave).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4317);
const HOST = process.env.HOST || '127.0.0.1';
const TOKEN = process.env.OFFICE_TOKEN || '';
const DATA = path.resolve(process.env.OFFICE_DATA || path.join(here, 'data'));
const PUBLIC = path.join(here, 'public');
const MAX_EVENTS = 300;

fs.mkdirSync(DATA, { recursive: true });
const agentsFile = path.join(DATA, 'agents.json');
const stateFile = path.join(DATA, 'state.json');
if (!fs.existsSync(agentsFile)) fs.copyFileSync(path.join(here, 'agents.example.json'), agentsFile);

/* ---------------- dados ---------------- */

function readJSON(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }

let config = loadConfig();
function loadConfig() {
  const c = readJSON(agentsFile, null);
  if (!c || !Array.isArray(c.agents)) { console.error(`[escritório] ${agentsFile} inválido — usando lista vazia.`); return { title: 'Escritório', boss: '', agents: [] }; }
  c.agents = c.agents.filter((a) => a && typeof a.id === 'string').map((a) => ({
    id: String(a.id).slice(0, 40), name: String(a.name ?? a.id).slice(0, 30), project: String(a.project ?? '').slice(0, 60),
    role: a.role ? String(a.role).slice(0, 200) : undefined, color: /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : '#7c8191',
    icon: a.icon ?? 'bot', staleMin: Number(a.staleMin) > 0 ? Number(a.staleMin) : 60, avatar: a.avatar,
  }));
  return { title: String(c.title ?? 'Escritório'), boss: String(c.boss ?? ''), agents: c.agents };
}
fs.watchFile(agentsFile, { interval: 2000 }, () => { config = loadConfig(); console.log('[escritório] agents.json recarregado'); broadcast(); });

const saved = readJSON(stateFile, {});
const latest = saved.latest && typeof saved.latest === 'object' ? saved.latest : {};
const events = Array.isArray(saved.events) ? saved.events.slice(0, MAX_EVENTS) : [];
let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = stateFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ latest, events }, null, 1));
    fs.renameSync(tmp, stateFile);
  }, 500);
}

const clients = new Set(); // { res, nome }
function snapshot() {
  return { title: config.title, boss: config.boss, agents: config.agents, latest, events: events.slice(0, 60), viewers: [...new Set([...clients].map((c) => c.nome))], ai: !!process.env.ANTHROPIC_API_KEY, now: Date.now() };
}
function broadcast() {
  const data = `data: ${JSON.stringify(snapshot())}\n\n`;
  for (const c of clients) c.res.write(data);
}
setInterval(() => { for (const c of clients) c.res.write(': ping\n\n'); }, 25000);

/* ---------------- boletins ---------------- */

const str = (v, n) => (v == null || v === '' ? undefined : String(v).slice(0, n));
const STATUS = new Set(['working', 'idle', 'done', 'error']);

function acceptReport(body) {
  const id = str(body.agent, 40);
  const agent = config.agents.find((a) => a.id === id);
  if (!agent) return { error: `robô "${id}" não existe. Robôs: ${config.agents.map((a) => a.id).join(', ')} (edite ${agentsFile})`, code: 404 };
  const prev = latest[id] ?? {};
  const status = STATUS.has(body.status) ? body.status : prev.status ?? 'working';
  const r = {
    agent: id, status,
    task: str(body.task, 140) ?? (body.task === undefined ? prev.task : undefined),
    detail: str(body.detail, 140) ?? (body.detail === undefined ? prev.detail : undefined),
    progress: Number.isFinite(Number(body.progress)) && body.progress !== null && body.progress !== '' ? Math.max(0, Math.min(100, Number(body.progress))) : (body.progress === undefined ? prev.progress : undefined),
    tasks: Array.isArray(body.tasks) ? body.tasks.slice(0, 8).map((t) => ({ name: str(t?.name, 80) ?? '?', progress: Number.isFinite(Number(t?.progress)) ? Math.max(0, Math.min(100, Number(t.progress))) : undefined })) : prev.tasks,
    event: str(body.event, 160) ?? prev.event,
    error: status === 'error' ? str(body.error, 200) ?? prev.error : undefined,
    metrics: body.metrics && typeof body.metrics === 'object' ? Object.fromEntries(Object.entries(body.metrics).slice(0, 8).map(([k, v]) => [String(k).slice(0, 30), typeof v === 'number' ? v : String(v).slice(0, 30)])) : prev.metrics,
    ts: Date.now(),
  };
  latest[id] = r;
  const evText = str(body.event, 160) ?? (status === 'error' && prev.status !== 'error' ? `Erro: ${r.error ?? 'sem detalhes'}` : status === 'done' && prev.status !== 'done' ? `Concluiu: ${r.task ?? 'tarefa'}` : null);
  if (evText) {
    events.unshift({ agent: id, ts: r.ts, text: evText, kind: status === 'error' ? 'error' : status === 'done' ? 'done' : 'info' });
    events.length = Math.min(events.length, MAX_EVENTS);
  }
  persist();
  broadcast();
  return { ok: true };
}

/* ---------------- conversa com IA ---------------- */

let client = null;
async function ai() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (client) return client;
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    client = new Anthropic();
    return client;
  } catch {
    console.error('[escritório] Para a IA: rode "npm install" na pasta colchao-ao-imperio.');
    return null;
  }
}

function fallbackReply(agent, r) {
  if (!r) return `Ainda não recebi boletins do meu robô, chefe. Assim que ele mandar o primeiro, eu sei te responder.`;
  const parts = [r.task && `Estou ${r.task.charAt(0).toLowerCase() + r.task.slice(1)}${r.progress != null ? ` (${Math.round(r.progress)}%)` : ''}.`, r.event && `Última novidade: ${r.event}.`, r.error && `Problema: ${r.error}.`];
  const m = r.metrics ? Object.entries(r.metrics).map(([k, v]) => `${k}: ${v}`).join(', ') : '';
  return `${parts.filter(Boolean).join(' ')}${m ? ` Números: ${m}.` : ''} (IA desligada — defina ANTHROPIC_API_KEY para eu conversar de verdade.)`;
}

async function chat(body) {
  const agent = config.agents.find((a) => a.id === body.agent);
  if (!agent) return { code: 404, error: 'robô não existe' };
  const message = str(body.message, 400);
  if (!message) return { code: 400, error: 'mensagem vazia' };
  const r = latest[agent.id];
  const c = await ai();
  if (!c) return { reply: fallbackReply(agent, r), ai: false };
  const hist = events.filter((e) => e.agent === agent.id).slice(0, 15).map((e) => `- ${new Date(e.ts).toLocaleString('pt-BR')}: ${e.text}`).join('\n');
  const system = `Você é ${agent.name}, um funcionário em pixel art de um escritório virtual. Você representa um robô/automação real do chefe: "${agent.project}"${agent.role ? ` — ${agent.role}` : ''}.
Responda em português do Brasil, em 1 a 4 frases, com tom simpático de funcionário falando com o chefe${config.boss ? ` (${config.boss})` : ''}.
Use SOMENTE os dados abaixo. Nunca invente números, ofertas, vídeos ou resultados. Se a resposta não estiver nos dados, diga que o robô ainda não relatou isso.

Último boletim (JSON): ${JSON.stringify(r ?? null)}
Agora: ${new Date().toLocaleString('pt-BR')}
Histórico recente:
${hist || '(vazio)'}`;
  try {
    const res = await c.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages: [{ role: 'user', content: message }],
    });
    if (res.stop_reason === 'refusal') return { reply: 'Prefiro não responder isso, chefe. Pergunte algo sobre o meu trabalho!', ai: true };
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    return { reply: text || fallbackReply(agent, r), ai: true };
  } catch (err) {
    console.error('[escritório] erro na IA:', err?.status ?? '', err?.message ?? err);
    return { reply: `${fallbackReply(agent, r)}`, ai: false };
  }
}

/* ---------------- HTTP ---------------- */

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

function send(res, code, obj) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' });
  res.end(JSON.stringify(obj));
}
function authorized(req, url) {
  if (!TOKEN) return true;
  return url.searchParams.get('k') === TOKEN || req.headers.authorization === `Bearer ${TOKEN}`;
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (d) => { s += d; if (s.length > 64_000) { reject(new Error('corpo grande demais')); req.destroy(); } });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error('JSON inválido')); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type, authorization', 'access-control-allow-methods': 'GET, POST' }); return res.end(); }
  if (url.pathname.startsWith('/api/')) {
    if (!authorized(req, url)) return send(res, 401, { error: 'token inválido (use ?k=senha)' });
    try {
      if (url.pathname === '/api/state' && req.method === 'GET') return send(res, 200, snapshot());
      if (url.pathname === '/api/stream' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'access-control-allow-origin': '*' });
        const c = { res, nome: (url.searchParams.get('nome') || 'Visitante').slice(0, 24) };
        clients.add(c);
        broadcast();
        req.on('close', () => { clients.delete(c); broadcast(); });
        return;
      }
      if (url.pathname === '/api/report' && req.method === 'POST') {
        const body = await readBody(req);
        const list = Array.isArray(body) ? body : [body];
        const out = list.map(acceptReport);
        const bad = out.find((o) => o.error);
        return send(res, bad ? bad.code : 200, bad ? { error: bad.error } : { ok: true });
      }
      if (url.pathname === '/api/chat' && req.method === 'POST') {
        const out = await chat(await readBody(req));
        return send(res, out.code ?? 200, out.code ? { error: out.error } : out);
      }
      return send(res, 404, { error: 'rota não existe' });
    } catch (err) {
      return send(res, 400, { error: String(err?.message ?? err) });
    }
  }
  // página do escritório (arquivo único gerado por "npm run build:office")
  const file = url.pathname === '/' ? 'escritorio.html' : decodeURIComponent(url.pathname.slice(1));
  let full = path.resolve(PUBLIC, file);
  const shared = path.resolve(here, '..', 'public'); // favicon e ícones do jogo
  if (!fs.existsSync(full) && path.resolve(shared, file).startsWith(shared + path.sep)) full = path.resolve(shared, file);
  const okDir = full.startsWith(PUBLIC + path.sep) || full.startsWith(shared + path.sep);
  if (!okDir || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    if (url.pathname === '/') { res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('Página do escritório não encontrada. Rode: npm run build:office'); }
    res.writeHead(404); return res.end();
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(full)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
  fs.createReadStream(full).pipe(res);
});

server.listen(PORT, HOST, () => {
  const where = HOST === '0.0.0.0' ? `http://<IP-do-seu-PC>:${PORT}` : `http://localhost:${PORT}`;
  console.log(`\n  Escritório dos Robôs rodando em ${where}${TOKEN ? '/?k=' + TOKEN : ''}`);
  console.log(`  Robôs: ${config.agents.map((a) => a.id).join(', ') || '(nenhum)'}  ·  configuração: ${agentsFile}`);
  console.log(`  IA nas conversas: ${process.env.ANTHROPIC_API_KEY ? 'ligada' : 'desligada (defina ANTHROPIC_API_KEY)'}`);
  console.log(`  Teste: node office-server/report.mjs alfredo working "Pesquisando ofertas" --progress 40 --event "Encontrou 12 ofertas"\n`);
});
