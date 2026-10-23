import { describe, expect, it, vi } from 'vitest';
import { buildOffice } from '../src/office/layout';
import { DEFAULT_AGENTS } from '../src/office/defaults';
import { checkPlacement, roomInfo } from '../src/game/room';
import { speech, viewState } from '../src/office/speech';
import type { AgentConfig } from '../src/office/types';

const many: AgentConfig[] = Array.from({ length: 9 }, (_, i) => ({ id: `r${i}`, name: `R${i}`, project: 'p', color: '#3388ff', icon: 'bot' }));

describe('escritório', () => {
  for (const [label, agents] of [['4 robôs', DEFAULT_AGENTS], ['1 robô', DEFAULT_AGENTS.slice(0, 1)], ['9 robôs', many]] as const) {
    it(`monta sem móveis faltando nem sobrepostos (${label})`, () => {
      const warn = vi.spyOn(console, 'warn');
      const b = buildOffice(agents as AgentConfig[], 'Cauê');
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
      // cada estação: tapete, cadeira, mesa, 2 monitores, teclado, PC
      const ids = b.save.game.inventory.map((i) => i.defId);
      expect(ids.filter((i) => i.startsWith('of-cadeira-')).length).toBe(agents.length);
      expect(ids.filter((i) => i === 'monitor-24-black').length).toBe(agents.length * 2);
      expect(ids.filter((i) => i === 'pc-rgb1-black').length).toBe(agents.length);
      expect(ids).toContain('cafeteira-espresso');
      const room = roomInfo(b.save);
      for (const pi of room.placed) {
        const res = checkPlacement(room, pi.def, pi.p, pi.item.uid);
        expect(res.ok, `${pi.def.id} em ${pi.p.x},${pi.p.y}: ${res.reason}`).toBe(true);
      }
      expect(b.specs.length).toBe(agents.length);
      for (const s of b.specs) expect(s.seat).toBeGreaterThan(0);
    });
  }
  it('fala usa só o que o robô relatou', () => {
    const a = DEFAULT_AGENTS[0];
    const now = Date.now();
    expect(viewState(a, undefined, now)).toBe('never');
    expect(viewState(a, { agent: 'alfredo', ts: now - 2 * 3600_000 }, now)).toBe('offline');
    const s = speech(a, { agent: 'alfredo', status: 'working', task: 'Pesquisando ofertas de fones', event: 'Encontrou 12 ofertas', ts: now }, now, 'Cauê Monteiro');
    expect(s).toContain('chefe Cauê');
    expect(s).toContain('pesquisando ofertas de fones');
    expect(s).toContain('encontrou 12 ofertas');
  });
});
