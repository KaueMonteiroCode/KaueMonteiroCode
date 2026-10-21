import { useMemo } from 'react';
import { formatBRL } from '../core/money';
import { currentMissions } from '../game/missions';
import { activeEvents } from '../game/meta';
import * as A from '../state/actions';
import type { SaveData } from '../state/types';
import { sfx } from '../audio/sfx';
import { act, Coins, Drawer, Icon, Progress } from './common';

const PERIOD: Record<string, string> = { historia: 'História', evento: 'Evento especial', diaria: 'Diárias', semanal: 'Semanais' };

export function MissionsPanel({ save, onClose }: { save: SaveData; onClose: () => void }) {
  const list = useMemo(() => currentMissions(save), [save]);
  const events = activeEvents();
  const groups = ['historia', 'evento', 'diaria', 'semanal'] as const;
  return (
    <Drawer title="Missões" icon="target" onClose={onClose}>
      <div className="hint" style={{ marginBottom: 10 }}>Missões premiam hábitos saudáveis, nunca gastar. Ficou uns dias sem registrar? Sem problema: as diárias simplesmente renovam, nada é perdido.</div>
      {events.map((e) => <div key={e.id} className="card" style={{ boxShadow: `0 0 0 2px ${e.color}` }}><b style={{ color: e.color }}>{e.name}</b><div className="small muted">{e.desc} Itens exclusivos na loja enquanto durar.</div></div>)}
      {groups.map((g) => {
        const ms = list.filter((m) => m.period === g);
        if (!ms.length) return null;
        return (
          <div key={g} style={{ marginTop: 12 }}>
            <div className="pix small" style={{ marginBottom: 6, fontSize: 10, color: 'var(--ink-2)' }}>{PERIOD[g]}</div>
            <div className="list">
              {ms.map((m) => (
                <div key={m.key} className={`li ${m.claimed ? 'done' : ''}`}>
                  <Icon name={m.claimed ? 'check' : m.done ? 'star' : 'target'} size={22} />
                  <div className="grow">
                    <div style={{ fontWeight: 700 }}>{m.name}</div>
                    <div className="small muted">{m.desc}</div>
                    {m.target > 1 && !m.claimed && <div style={{ marginTop: 4 }}><Progress value={m.cur} max={m.target} /><div className="tiny muted">{m.target >= 1000 ? `${formatBRL(m.cur)} / ${formatBRL(m.target)}` : `${m.cur}/${m.target}`}</div></div>}
                  </div>
                  <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Coins n={m.coins} className="gold" />
                    {m.claimed ? <span className="tiny pos">Resgatada</span>
                      : <button className="btn sm gold" disabled={!m.done} onClick={() => { const ok = act(() => { A.claim(m.key, m.coins, m.xp, m.name); return true; }); if (ok) sfx.coin(); }}>Resgatar</button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </Drawer>
  );
}
