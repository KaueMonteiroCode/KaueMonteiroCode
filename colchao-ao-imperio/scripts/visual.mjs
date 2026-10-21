/**
 * Ferramenta de inspeção visual (dev): gera folhas com as miniaturas de todos os móveis
 * e screenshots de cada imóvel. Requer `npm run dev` rodando.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const URL = process.env.E2E_URL ?? 'http://localhost:5173';
const OUT = process.env.SHOTS ?? 'e2e-shots';
const exe = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: exe });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL);
  await page.waitForTimeout(500);
  const pages = await page.evaluate(async () => {
    const { SHOP_ITEMS, ITEM_LIST } = await import('/src/game/catalog.ts');
    const { drawItemThumb } = await import('/src/engine/thumbs.ts');
    const all = ITEM_LIST;
    const per = 96, cols = 14, rows = 9, perPage = cols * rows;
    const out = [];
    for (let p = 0; p * perPage < all.length; p++) {
      const c = document.createElement('canvas');
      c.width = cols * per; c.height = rows * (per + 14);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#1e1a28'; ctx.fillRect(0, 0, c.width, c.height);
      all.slice(p * perPage, (p + 1) * perPage).forEach((def, i) => {
        const t = document.createElement('canvas'); t.width = per; t.height = per;
        drawItemThumb(t, def, 0.7);
        const x = (i % cols) * per, y = Math.floor(i / cols) * (per + 14);
        ctx.drawImage(t, x, y);
        ctx.fillStyle = '#ccc'; ctx.font = '9px monospace'; ctx.fillText(def.id.slice(0, 17), x + 2, y + per + 10);
      });
      out.push(c.toDataURL());
    }
    return { out, n: SHOP_ITEMS.length };
  });
  pages.out.forEach((d, i) => fs.writeFileSync(path.join(OUT, `sheet-${i}.png`), Buffer.from(d.split(',')[1], 'base64')));
  console.log('folhas:', pages.out.length, 'itens na loja:', pages.n);

  // cada imóvel com alguns móveis
  const props = await page.evaluate(async () => (await import('/src/game/properties.ts')).PROPERTIES.map((p) => p.id));
  for (const pid of props) {
    await page.evaluate(async (pid) => {
      const { newSave, roomDefaults, starterItems } = await import('/src/state/defaults.ts');
      const { setState } = await import('/src/state/store.ts');
      const s = newSave();
      s.profile.onboarded = true; s.profile.name = 'Teste';
      s.game.ownedProperties.push(pid); s.game.currentProperty = pid; s.game.rooms[pid] = roomDefaults(pid);
      const items = starterItems(pid, 1000); s.game.inventory.push(...items);
      setState(s, false);
    }, pid);
    await page.waitForTimeout(300);
    if (!(await page.locator('.dock').count())) await page.getByRole('button', { name: /Continuar/ }).click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, `prop-${pid}.png`) });
  }
  console.log('erros:', errors);
  await browser.close();
})();
