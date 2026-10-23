/**
 * Ajudante para robôs em Node.js:
 *   import { report } from './office-server/client.mjs';
 *   await report({ agent: 'alfredo', status: 'working', task: 'Pesquisando ofertas', progress: 40 });
 * Nunca derruba o seu robô: se o escritório estiver fechado, só ignora.
 */
export async function report(body, { url = process.env.OFFICE_URL || 'http://localhost:4317', token = process.env.OFFICE_TOKEN } = {}) {
  try {
    const res = await fetch(`${url}/api/report${token ? `?k=${encodeURIComponent(token)}` : ''}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch { return false; }
}
