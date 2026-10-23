#!/usr/bin/env node
/**
 * Envia um boletim de robô para o Escritório.
 *   node office-server/report.mjs <robô> <status> "<tarefa>" [--progress 40] [--event "texto"] [--error "motivo"] [--detail "texto"]
 * status: working | idle | done | error
 * Variáveis: OFFICE_URL (padrão http://localhost:4317), OFFICE_TOKEN
 */
const [agent, status, task, ...rest] = process.argv.slice(2);
if (!agent) {
  console.log('Uso: node office-server/report.mjs alfredo working "Pesquisando ofertas" --progress 40 --event "Encontrou 12 ofertas"');
  process.exit(1);
}
const body = { agent, status, task };
for (let i = 0; i < rest.length; i += 2) {
  const k = rest[i].replace(/^--/, '');
  body[k] = k === 'progress' ? Number(rest[i + 1]) : rest[i + 1];
}
const base = process.env.OFFICE_URL || 'http://localhost:4317';
const k = process.env.OFFICE_TOKEN;
const res = await fetch(`${base}/api/report${k ? `?k=${encodeURIComponent(k)}` : ''}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch((e) => {
  console.error(`Não consegui falar com ${base} — o servidor do escritório está aberto? (${e.message})`);
  process.exit(2);
});
const out = await res.json().catch(() => ({}));
if (!res.ok) { console.error('Erro:', out.error ?? res.status); process.exit(3); }
console.log('Boletim enviado ✔');
