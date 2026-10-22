/**
 * QA ampla da interface (dev): percorre as telas financeiras e de jogo, verificando erros.
 * Requer `npm run dev`. Uso: node scripts/qa.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.E2E_URL ?? 'http://localhost:5173';
const OUT = process.env.SHOTS ?? 'e2e-shots';
const exe = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
fs.mkdirSync(OUT, { recursive: true });
const ok = (c, m) => { if (!c) throw new Error('FALHOU: ' + m); console.log('  ✓ ' + m); };

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('fonts.g')) errors.push(m.text()); });
  const shot = (n) => page.screenshot({ path: path.join(OUT, `qa-${n}.png`) });
  const save = async () => { await page.waitForTimeout(400); return page.evaluate(() => JSON.parse(localStorage.getItem('colchao-ao-imperio:save'))); };
  const btn = (name) => page.getByRole('button', { name, exact: false });
  const dock = (t) => page.locator('.dock button', { hasText: t }).click();
  const tab = (t) => page.locator('.tabs button', { hasText: t }).click();
  const modal = () => page.locator('.modal');

  await page.goto(URL);
  await btn(/Novo jogo/).click();
  for (const b of [/Olhar em volta/, /Quem sou eu/, /Esse sou eu/]) await btn(b).click();
  // valores iniciais
  const inputs = page.locator('.modal input[inputmode="decimal"]');
  await inputs.nth(0).fill('1500');
  await inputs.nth(1).fill('80,50');
  await inputs.nth(3).fill('2000');
  await btn(/^Salvar/).click();
  await btn(/Entendi/).click();
  await btn(/Pegar presente/).click();
  let s = await save();
  ok(s.finance.accounts.length === 3, 'onboarding criou 3 contas (corrente, carteira, dívida)');
  await page.waitForTimeout(500);

  // ---- finanças ----
  await dock('Finanças');
  await tab('Cartões');
  await btn('+ Cartão').click();
  await modal().locator('input').first().fill('Cartão Roxo');
  await page.locator('.modal input[type="number"]').nth(0).fill('5');
  await btn(/^Salvar$/).click();
  await btn('+ Compra no cartão').click();
  await modal().locator('input[inputmode="decimal"]').fill('600');
  await modal().locator('select').nth(2).selectOption('6');
  await modal().locator('input').last().fill('Fone novo');
  await modal().getByRole('button', { name: 'Registrar' }).click();
  s = await save();
  const card = s.finance.transactions.find((t) => t.installments);
  ok(card && card.installments.count === 6 && card.installments.amounts.reduce((a, b) => a + b, 0) === 60000, 'compra parcelada 6x somando exatamente R$ 600');
  await shot('cartoes');

  await tab('Dívidas');
  await page.locator('.card', { hasText: 'Dívidas existentes' }).getByRole('button', { name: 'Editar' }).click();
  await page.locator('.modal label', { hasText: 'Tem parcelas fixas' }).click();
  const di = modal().locator('input[inputmode="decimal"]');
  await di.nth(1).fill('500');
  await modal().locator('input[type="number"]').fill('4');
  await btn(/^Salvar$/).click();
  await page.locator('.card', { hasText: 'Dívidas existentes' }).getByRole('button', { name: /Antecipar|Pagar/ }).first().click();
  await btn('Confirmar pagamento').click();
  s = await save();
  ok(s.finance.transactions.some((t) => t.debtInstallment?.number === 1), 'parcela 1 da dívida paga');
  await page.waitForTimeout(400);
  await shot('dividas');

  await tab('Recorrentes');
  await btn('+ Nova').click();
  await modal().locator('input').first().fill('Internet');
  await modal().locator('input[inputmode="decimal"]').fill('99,90');
  await modal().locator('input[type="number"]').fill('1');
  const start = new Date(); start.setMonth(start.getMonth() - 1); start.setDate(1);
  await modal().locator('input[type="date"]').first().fill(start.toISOString().slice(0, 10));
  await btn(/^Salvar$/).click();
  await page.locator('.seg button', { hasText: 'Metas' }).click();
  await btn('+ Meta').click();
  await modal().locator('input').first().fill('Notebook');
  await modal().locator('input[inputmode="decimal"]').fill('3000');
  await btn(/^Salvar$/).click();
  await page.locator('.seg button', { hasText: 'Orçamento' }).click();
  await page.locator('.li', { hasText: 'Mercado' }).getByRole('button', { name: /Definir limite/ }).click();
  await page.locator('.li', { hasText: 'Mercado' }).locator('input').fill('800');
  await page.locator('.li', { hasText: 'Mercado' }).getByRole('button', { name: 'OK' }).click();
  s = await save();
  ok(s.finance.recurring.length === 1 && s.finance.goals.length === 1 && s.finance.budgets.length === 1, 'recorrência, meta e orçamento criados');

  await tab('Calendário');
  await page.waitForTimeout(300);
  await shot('calendario');
  // volta um mês e confirma a ocorrência vencida
  await page.locator('.drawer-body .row.between button').first().click();
  await page.locator('.cal .d', { has: page.locator('.ev', { hasText: 'Internet' }) }).first().click();
  await modal().getByRole('button', { name: 'Confirmar' }).click();
  await page.locator('.modal').last().getByRole('button', { name: 'Confirmar' }).click();
  s = await save();
  ok(s.finance.transactions.some((t) => t.recurringId), 'ocorrência recorrente confirmada pelo calendário');
  await page.keyboard.press('Escape');

  await tab('Lançamentos');
  await page.locator('.drawer-body button', { hasText: 'Todos' }).first().click();
  await page.waitForTimeout(200);
  await shot('lancamentos');
  await page.locator('.li', { hasText: 'Fone novo' }).locator('button[title="Corrigir"]').click();
  await modal().locator('input[inputmode="decimal"]').fill('590');
  await btn('Salvar correção').click();
  s = await save();
  const fone = s.finance.transactions.find((t) => t.description === 'Fone novo');
  ok(fone.amount === 59000 && fone.history.length === 1, 'correção de lançamento com histórico');
  await tab('Estatísticas');
  await page.waitForTimeout(300);
  await shot('estatisticas');
  await tab('Resumo');
  await page.waitForTimeout(200);
  await shot('resumo');
  await tab('Importar');
  await page.waitForTimeout(200);

  // ---- decorar ----
  await dock('Finanças');
  await dock('Decorar');
  await page.waitForTimeout(900);
  const target = await page.evaluate(() => {
    const e = window.__engine; const r = e.canvas.getBoundingClientRect();
    const pi = e.room.placed.find((p) => p.def.id === 'cadeira-plastico-branca');
    const w = e.worldToScreen(e.O.x + (pi.p.x + 0.5 - (pi.p.y + 0.5)) * 32, e.O.y + (pi.p.x + 0.5 + pi.p.y + 0.5) * 16 - 16);
    return { x: r.left + w.x / e.dpr, y: r.top + w.y / e.dpr };
  });
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(200);
  ok(await page.locator('.editbar', { hasText: 'Cadeira de plástico branca' }).count() === 1, 'modo decorar seleciona item clicado');
  await page.locator('.editbar button', { hasText: 'Girar' }).click();
  s = await save();
  ok(s.game.inventory.find((i) => i.defId === 'cadeira-plastico-branca').placed.rot === 3, 'girar item');
  await page.locator('.editbar button', { hasText: 'Guardar' }).click();
  s = await save();
  ok(s.game.inventory.find((i) => i.defId === 'cadeira-plastico-branca').placed === null, 'guardar no inventário');
  await shot('decorar');
  await page.locator('.editbar button', { hasText: 'Concluir' }).click();

  // ---- interações no modo jogo ----
  const clickItem = async (defId, dz = 0.3) => {
    const pt = await page.evaluate(({ defId, dz }) => {
      const e = window.__engine; const r = e.canvas.getBoundingClientRect();
      const pi = e.room.placed.find((p) => p.def.id === defId);
      const cx = pi.p.x + pi.w / 2, cy = pi.p.y + pi.d / 2, z = pi.z + dz;
      const w = e.worldToScreen(e.O.x + (cx - cy) * 32, e.O.y + (cx + cy) * 16 - z * 32);
      return { x: r.left + w.x / e.dpr, y: r.top + w.y / e.dpr };
    }, { defId, dz });
    await page.mouse.click(pt.x, pt.y);
  };
  await clickItem('colchao-chao', 0.1);
  await page.waitForTimeout(2500);
  ok(await page.evaluate(() => window.__engine.player.anim) === 'sleep', 'clicar no colchão: personagem deita e dorme');
  await shot('dormindo');
  await clickItem('monitor-tubo', 0.3);
  await page.waitForTimeout(3000);
  ok(await page.locator('.drawer h2', { hasText: 'Finanças' }).count() === 1, 'usar o computador abre as finanças sem sair do jogo');
  await shot('computador');
  await page.locator('.drawer-head button').click();

  // ---- melhorias: badge, desfazer, repetir, meta, desejos, inventário, atalhos ----
  ok(await page.locator('.dock button', { hasText: 'Finanças' }).locator('.badge').count() === 1, 'botão Finanças mostra aviso de conta vencida (parcela de dívida atrasada)');
  await page.keyboard.press('f');
  await page.waitForTimeout(200);
  ok(await page.locator('.drawer h2', { hasText: 'Finanças' }).count() === 1, 'atalho F abre finanças');
  ok(await page.locator('.card', { hasText: 'Raio-X do mês' }).count() === 1, 'Raio-X do mês aparece no resumo');
  await tab('Lançamentos');
  await page.locator('.li', { hasText: 'Fone novo' }).locator('button[title="Repetir hoje"]').click();
  await modal().getByRole('button', { name: 'Registrar' }).click();
  s = await save();
  ok(s.finance.transactions.filter((t) => t.description === 'Fone novo' && !t.deleted).length === 2, 'repetir lançamento cria uma cópia para hoje');
  const nBefore = s.finance.transactions.filter((t) => !t.deleted).length;
  await page.locator('.li', { hasText: 'Fone novo' }).first().locator('button[title="Excluir"]').click();
  await page.locator('.modal').getByRole('button', { name: 'Excluir' }).click();
  await page.locator('.toast button', { hasText: 'Desfazer' }).click();
  s = await save();
  ok(s.finance.transactions.filter((t) => !t.deleted).length === nBefore, 'desfazer exclusão restaura o lançamento');
  await tab('Contas');
  await btn('+ Conta').click();
  await modal().locator('input').first().fill('Cofre do notebook');
  await modal().locator('select').selectOption('reserve');
  await btn(/^Salvar$/).click();
  await tab('Recorrentes');
  await page.locator('.seg button', { hasText: 'Metas' }).click();
  await page.locator('.card', { hasText: 'Notebook' }).getByRole('button', { name: 'Editar' }).click();
  await modal().locator('select').first().selectOption({ label: 'Cofre do notebook' });
  await btn(/^Salvar$/).click();
  await page.locator('.card', { hasText: 'Notebook' }).getByRole('button', { name: 'Guardar nesta meta' }).click();
  await modal().locator('input[inputmode="decimal"]').fill('150');
  await modal().getByRole('button', { name: 'Guardar', exact: true }).click();
  s = await save();
  ok(s.finance.transactions.some((t) => t.description === 'Guardado para Notebook' && t.amount === 15000), 'guardar nesta meta registra transferência');
  await shot('meta');
  await page.keyboard.press('Escape');
  await page.keyboard.press('l');
  await page.locator('.items-grid .item-card').first().waitFor();
  await page.locator('input[placeholder="Buscar…"]').fill('Bonsai');
  await page.locator('.items-grid .item-card').first().click();
  await btn('Quero este').click();
  await page.keyboard.press('Escape');
  s = await save();
  ok(s.game.wishlist.length === 1, 'item adicionado à lista de desejos');
  await page.locator('.catbar button', { hasText: 'Desejos' }).click();
  ok(await page.locator('.items-grid .item-card').count() === 1, 'aba Desejos filtra a lista');
  await shot('desejos');
  await page.locator('input[placeholder="Buscar…"]').fill('Cacto');
  await page.locator('.catbar button', { hasText: 'Tudo' }).click();
  await page.locator('.items-grid .item-card').first().click();
  await btn('Comprar e guardar').click();
  await page.keyboard.press('i');
  await page.waitForTimeout(200);
  await page.locator('input[aria-label="Buscar no inventário"]').fill('Cacto');
  await page.locator('.item-card', { hasText: 'Cacto' }).getByRole('button', { name: 'Auto' }).click();
  s = await save();
  ok(s.game.inventory.some((i) => i.defId.startsWith('planta-cactus') && i.placed), 'inventário: busca + colocar sozinho');
  await page.keyboard.press('Escape');

  // ---- imóveis e personagem ----
  await dock('Imóveis');
  await page.waitForTimeout(200);
  await shot('imoveis');
  await dock('Imóveis');
  await page.locator('.hud-player').click();
  await page.waitForTimeout(200);
  await shot('personagem');
  await page.locator('.drawer-head button').click();
  await dock('Ajustes');
  await page.waitForTimeout(200);
  await dock('Ajustes');
  ok(errors.length === 0, `sem erros no console (${errors.slice(0, 3).join(' | ')})`);
  await browser.close();
  console.log('QA OK');
})().catch((e) => { console.error(e); process.exit(1); });
