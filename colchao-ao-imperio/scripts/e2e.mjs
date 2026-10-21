/**
 * Teste de ponta a ponta do critério de sucesso:
 * abrir o jogo -> ver o quarto -> registrar R$ 25 -> ganhar moedas -> comprar -> posicionar ->
 * fechar o navegador -> reabrir -> tudo salvo.
 *
 * Uso: npm run dev (em outro terminal) e depois `npm run e2e`.
 * Variáveis: E2E_URL (padrão http://localhost:5173), CHROMIUM (caminho do executável), SHOTS (pasta de screenshots)
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const URL = process.env.E2E_URL ?? 'http://localhost:5173';
const SHOTS = process.env.SHOTS ?? 'e2e-shots';
const exe = process.env.CHROMIUM ?? (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'colchao-e2e-'));
fs.mkdirSync(SHOTS, { recursive: true });

const mobile = process.argv.includes('--mobile');
const ctxOpts = mobile
  ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
  : { viewport: { width: 1366, height: 820 } };

function ok(cond, msg) { if (!cond) throw new Error('FALHOU: ' + msg); console.log('  ✓ ' + msg); }

async function open() {
  const ctx = await chromium.launchPersistentContext(userDir, { headless: true, executablePath: exe, ...ctxOpts });
  const page = ctx.pages()[0] ?? await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('fonts.g')) errors.push(m.text()); });
  await page.goto(URL);
  return { ctx, page, errors };
}

const tap = async (page, loc) => { if (mobile) await loc.tap(); else await loc.click(); };
async function dockBtn(page, name) {
  const b = page.locator('.dock button', { hasText: name });
  if (await b.isVisible()) return tap(page, b);
  await tap(page, page.locator('.dock .more-btn'));
  await tap(page, page.locator('.more-menu button', { hasText: name }));
}
const shot = (page, n) => page.screenshot({ path: path.join(SHOTS, `${mobile ? 'mobile-' : ''}${n}.png`) });

async function coins(page) {
  const t = await page.locator('.hud-stat .val.gold').innerText();
  return Number(t.replace(/\D/g, ''));
}

(async () => {
  console.log(`E2E ${mobile ? '(mobile)' : '(desktop)'} em ${URL}`);
  let { ctx, page, errors } = await open();
  await page.getByRole('button', { name: /Novo jogo/ }).click();
  await page.getByRole('button', { name: /Olhar em volta/ }).click();
  await page.waitForTimeout(600);
  await shot(page, '01-quarto-precario');
  await page.getByRole('button', { name: /Quem sou eu/ }).click();
  await page.fill('#ob-name', 'Kauê');
  await page.getByRole('button', { name: /Esse sou eu/ }).click();
  await page.getByRole('button', { name: /^Salvar/ }).click(); // pula valores (todos vazios)
  await page.getByRole('button', { name: /Entendi/ }).click();
  await page.getByRole('button', { name: /Pegar presente/ }).click();
  await page.waitForTimeout(400);
  const c0 = await coins(page);
  ok(c0 >= 60, `presente de boas-vindas recebido (${c0} moedas)`);

  // registrar R$ 25
  await tap(page, page.locator('.dock button.save'));
  await page.fill('#sv-amt', '25');
  await page.getByRole('button', { name: 'Registrar' }).click();
  await page.waitForTimeout(900);
  const c1 = await coins(page);
  ok(c1 > c0, `registrar R$ 25 gerou moedas (${c0} -> ${c1})`);
  await shot(page, '02-moedas-apos-economia');

  // loja
  await tap(page, page.locator('.dock button', { hasText: 'Loja' }));
  await page.locator('.items-grid .item-card').first().waitFor();
  await shot(page, '03-loja');
  // escolhe uma planta acessível
  await page.fill('input[placeholder="Buscar…"]', 'Samambaia (vaso terracota)');
  await page.locator('.items-grid .item-card').first().click();
  await page.getByRole('button', { name: 'Comprar e posicionar' }).click();
  await page.waitForTimeout(400);
  const c2 = await coins(page);
  const spent = await page.evaluate(() => JSON.parse(localStorage.getItem('colchao-ao-imperio:save')).game.coinLedger.filter((e) => e.kind === 'buy').map((e) => e.amount));
  ok(spent.length === 1 && spent[0] < 0, `compra registrada no livro de moedas virtuais (${spent[0]}; saldo ${c1} -> ${c2}, inclui conquista de 1ª compra)`);
  const nwText = await page.locator('.hud-stat .val.pos, .hud-stat .val.neg').innerText();
  ok(/25,00/.test(nwText), `patrimônio real intacto após compra (${nwText})`);

  // posicionar: acha um tile válido usando o motor
  const spot = await page.evaluate(() => {
    const e = window.__engine;
    const r = e.canvas.getBoundingClientRect();
    for (let x = 0; x < e.room.W; x++) for (let y = 0; y < e.room.D; y++) {
      const w = e.worldToScreen(e.O.x + (x + 0.5 - (y + 0.5)) * 32, e.O.y + (x + 0.5 + y + 0.5) * 16);
      const sx = w.x / e.dpr, sy = w.y / e.dpr;
      const el = document.elementFromPoint(r.left + sx, r.top + sy);
      if (el !== e.canvas) continue;
      e.hover(w.x, w.y);
      if (e.hoverPlace?.ok) return { x: r.left + sx, y: r.top + sy, tile: [x, y] };
    }
    return null;
  });
  ok(!!spot, `tile livre encontrado ${JSON.stringify(spot?.tile)}`);
  if (mobile) { await page.touchscreen.tap(spot.x, spot.y); await page.waitForTimeout(250); await shot(page, '03b-previa'); await page.touchscreen.tap(spot.x, spot.y); } else { await page.mouse.move(spot.x, spot.y); await page.mouse.click(spot.x, spot.y); }
  await page.waitForTimeout(600);
  const placed = await page.evaluate(() => {
    const raw = localStorage.getItem('colchao-ao-imperio:save');
    const s = JSON.parse(raw);
    return s.game.inventory.filter((i) => i.defId.startsWith('planta-fern') && i.placed).length;
  });
  ok(placed === 1, 'planta posicionada no quarto');
  await shot(page, '04-item-posicionado');
  ok(errors.length === 0, `sem erros no console (${errors.join(' | ')})`);
  await ctx.close();

  // reabrir
  ({ ctx, page, errors } = await open());
  await page.getByRole('button', { name: /Continuar/ }).click();
  await page.waitForTimeout(800);
  const c3 = await coins(page);
  ok(c3 === c2, `moedas preservadas após reabrir (${c3})`);
  const after = await page.evaluate(() => window.__engine.room.placed.filter((p) => p.def.id.startsWith('planta-fern')).length);
  ok(after === 1, 'item continua no quarto após reabrir o navegador');
  const tx = await page.evaluate(() => JSON.parse(localStorage.getItem('colchao-ao-imperio:save')).finance.transactions.length);
  ok(tx === 1, 'lançamento de R$ 25 preservado');
  await shot(page, '05-reaberto');

  // telas extras para inspeção visual
  await tap(page, page.locator('.dock button', { hasText: 'Finanças' }));
  await page.waitForTimeout(300);
  await shot(page, '06-financas');
  await tap(page, page.locator('.tabs button', { hasText: 'Estatísticas' }));
  await page.waitForTimeout(300);
  await shot(page, '07-estatisticas');
  await dockBtn(page, 'Conquistas');
  await page.waitForTimeout(300);
  await shot(page, '08-conquistas');
  await tap(page, page.locator('.dock button', { hasText: 'Missões' }));
  await page.waitForTimeout(300);
  await shot(page, '09-missoes');
  await tap(page, page.locator('.dock button', { hasText: 'Missões' }));
  await tap(page, page.locator('.dock button', { hasText: 'Decorar' }));
  await page.waitForTimeout(300);
  await shot(page, '10-decorar');
  ok(errors.length === 0, `sem erros no console na 2ª sessão (${errors.join(' | ')})`);
  await ctx.close();
  fs.rmSync(userDir, { recursive: true, force: true });
  console.log('E2E OK');
})().catch((e) => { console.error(e); process.exit(1); });
