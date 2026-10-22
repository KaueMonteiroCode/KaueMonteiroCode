import { useState } from 'react';
import { formatBRL } from '../core/money';
import { expansionPrice, getProperty, PROPERTIES, roomSize } from '../game/properties';
import type { Progress } from '../game/progress';
import { LIGHT_THEMES } from '../game/styles';
import * as A from '../state/actions';
import type { SaveData } from '../state/types';
import { sfx } from '../audio/sfx';
import { act, Coins, Confirm, Drawer, Icon, Progress as Bar, toast } from './common';

export function PropertiesPanel({ save, progress, onClose }: { save: SaveData; progress: Progress; onClose: () => void }) {
  const [tab, setTab] = useState('imoveis');
  const [buy, setBuy] = useState<string | null>(null);
  const [layoutName, setLayoutName] = useState('');
  const cur = getProperty(save.game.currentProperty);
  const room = save.game.rooms[cur.id];
  const size = roomSize(cur, room.expansion);

  return (
    <Drawer help="properties" title="Imóveis" icon="house" onClose={onClose} tab={tab} setTab={setTab} tabs={[{ id: 'imoveis', label: 'Imóveis' }, { id: 'atual', label: 'Este ambiente' }, { id: 'layouts', label: 'Layouts salvos' }]}>
      {tab === 'imoveis' && (
        <div className="list">
          {PROPERTIES.map((p) => {
            const has = save.game.ownedProperties.includes(p.id);
            const here = p.id === save.game.currentProperty;
            const lvlOk = progress.level >= p.req.level;
            const gainOk = progress.metrics.peakGain >= p.req.gainCents;
            const prevOk = p.order === 1 || save.game.ownedProperties.includes(PROPERTIES[p.order - 2].id);
            return (
              <div key={p.id} className="card" style={{ boxShadow: here ? '0 0 0 2px var(--gold)' : undefined, opacity: has || (lvlOk && gainOk && prevOk) ? 1 : 0.7 }}>
                <div className="row between"><b>{p.order}. {p.name}</b>{here ? <span className="chip">Você está aqui</span> : has ? <span className="chip">Seu</span> : null}</div>
                <div className="small muted" style={{ margin: '4px 0' }}>{p.desc} · {p.w}x{p.d}{p.npcs ? ` · ${p.npcs} funcionário(s)` : ''}</div>
                {!has && (
                  <div className="small col" style={{ gap: 4 }}>
                    <div className="row"><Icon name={lvlOk ? 'check' : 'star'} size={12} />Nível {p.req.level} <span className="muted">(você: {progress.level})</span></div>
                    {p.req.gainCents > 0 && <div><div className="row"><Icon name={gainOk ? 'check' : 'star'} size={12} />Economia acumulada de {formatBRL(p.req.gainCents)}</div><Bar value={progress.metrics.peakGain} max={p.req.gainCents} /></div>}
                    {!prevOk && <div className="row muted"><Icon name="star" size={12} />Desbloqueie o imóvel anterior</div>}
                  </div>
                )}
                <div className="row" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
                  {has && !here && <button className="btn sm primary" onClick={() => { act(() => A.switchProperty(p.id)); sfx.open(); onClose(); }}>Ir para cá</button>}
                  {!has && <button className="btn sm gold" disabled={!(lvlOk && gainOk && prevOk) || progress.coins < p.price} onClick={() => setBuy(p.id)}>Desbloquear · <Coins n={p.price} /></button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {tab === 'atual' && (
        <>
          <div className="card">
            <b>{cur.name}</b>
            <div className="small muted">Tamanho atual: {size.w} x {size.d} · expansões {room.expansion}/{cur.maxExpansion}</div>
            {room.expansion < cur.maxExpansion && (
              <button className="btn gold sm" style={{ marginTop: 8 }} disabled={progress.coins < expansionPrice(cur, room.expansion + 1)} onClick={() => { const ok = act(() => { A.buyExpansion(); return true; }); if (ok) { sfx.buy(); toast('Ambiente expandido!', { kind: 'ok', icon: 'hammer' }); } }}>
                Expandir para {size.w + 1}x{size.d + 1} · <Coins n={expansionPrice(cur, room.expansion + 1)} />
              </button>
            )}
          </div>
          <div className="card">
            <b>Iluminação (grátis)</b>
            <div className="row wrap" style={{ marginTop: 6 }}>
              {Object.entries(LIGHT_THEMES).map(([id, t]) => <button key={id} className={`btn sm ${room.light === id ? 'gold' : ''}`} onClick={() => act(() => A.setLightTheme(id))}>{t.name}</button>)}
            </div>
          </div>
          <div className="small muted">Pisos e papéis de parede ficam na Loja, nas abas "Pisos" e "Papéis de parede".</div>
        </>
      )}
      {tab === 'layouts' && (
        <>
          <div className="card">
            <b>Salvar layout atual</b>
            <div className="row" style={{ marginTop: 6 }}>
              <input value={layoutName} onChange={(e) => setLayoutName(e.target.value)} placeholder="Ex.: Setup gamer" />
              <button className="btn primary" onClick={() => { act(() => A.saveLayout(layoutName), 'Layout salvo'); setLayoutName(''); }}>Salvar</button>
            </div>
          </div>
          <div className="list" style={{ marginTop: 10 }}>
            {room.layouts.map((l) => (
              <div key={l.id} className="li">
                <div className="grow"><b>{l.name}</b><div className="tiny muted">{l.items.length} móveis · {new Date(l.createdAt).toLocaleDateString('pt-BR')}</div></div>
                <button className="btn sm primary" onClick={() => { const miss = act(() => A.loadLayout(l.id)); if (miss != null) toast(miss ? `Layout aplicado. ${miss} item(ns) não disponíveis.` : 'Layout aplicado!', { kind: 'ok' }); }}>Aplicar</button>
                <button className="btn sm danger" onClick={() => act(() => A.deleteLayout(l.id))}>Excluir</button>
              </div>
            ))}
            {!room.layouts.length && <div className="small muted">Nenhum layout salvo neste imóvel.</div>}
          </div>
        </>
      )}
      {buy && (() => {
        const p = getProperty(buy);
        return <Confirm title={`Desbloquear ${p.name}?`} text={<>Custa <Coins n={p.price} /> moedas virtuais. Seus imóveis anteriores continuam seus e com a decoração intacta.</>} yes="Desbloquear" onClose={() => setBuy(null)} onYes={() => { const ok = act(() => { A.buyProperty(p.id); return true; }); if (ok) { sfx.achievement(); toast(`Bem-vindo ao ${p.name}!`, { kind: 'ach', icon: 'house' }); onClose(); } }} />;
      })()}
    </Drawer>
  );
}
