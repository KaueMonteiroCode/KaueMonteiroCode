import { useMemo, useState } from 'react';
import { CATEGORIES, getItem, sellPrice } from '../game/catalog';
import { getProperty } from '../game/properties';
import * as A from '../state/actions';
import type { SaveData } from '../state/types';
import { sfx } from '../audio/sfx';
import { act, Coins, Confirm, Drawer, ItemThumb, toast } from './common';
import { findFreeSpot, roomInfo } from '../game/room';

export function InventoryPanel({ save, onClose, onPlace }: { save: SaveData; onClose: () => void; onPlace: (uid: number) => void }) {
  const [filter, setFilter] = useState<'guardados' | 'aqui' | 'todos'>('guardados');
  const [sell, setSell] = useState<number | null>(null);
  const [storeAll, setStoreAll] = useState(false);
  const [q, setQ] = useState('');
  const pid = save.game.currentProperty;
  const groups = useMemo(() => {
    const items = save.game.inventory.filter((i) => filter === 'todos' || (filter === 'guardados' ? !i.placed : i.placed?.propertyId === pid)).filter((i) => !q.trim() || (getItem(i.defId)?.name ?? '').toLowerCase().includes(q.trim().toLowerCase()));
    const m = new Map<string, typeof items>();
    for (const i of items) { const k = i.defId + (i.placed ? `@${i.placed.propertyId}` : ''); m.set(k, [...(m.get(k) ?? []), i]); }
    return [...m.values()].sort((a, b) => (getItem(a[0].defId)?.cat ?? '').localeCompare(getItem(b[0].defId)?.cat ?? ''));
  }, [save, filter, pid, q]);
  const stored = save.game.inventory.filter((i) => !i.placed).length;

  return (
    <Drawer title="Inventário" icon="box" onClose={onClose} wide>
      <div className="row wrap between" style={{ marginBottom: 10 }}>
        <div className="seg" style={{ minWidth: 300 }}>
          {(['guardados', 'aqui', 'todos'] as const).map((f) => <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f === 'guardados' ? `Guardados (${stored})` : f === 'aqui' ? 'Neste imóvel' : 'Todos'}</button>)}
        </div>
        <button className="btn sm" onClick={() => setStoreAll(true)}>Guardar tudo deste imóvel</button>
      </div>
      <input placeholder="Buscar no inventário…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} aria-label="Buscar no inventário" />
      <div className="items-grid">
        {groups.map((g) => {
          const it = g[0]; const def = getItem(it.defId); if (!def) return null;
          return (
            <div key={it.uid} className="item-card" style={{ cursor: 'default' }}>
              <ItemThumb defId={def.id} />
              {g.length > 1 && <span className="qty">x{g.length}</span>}
              <div className="nm">{def.name}</div>
              <div className="tiny muted">{it.placed ? `No ${getProperty(it.placed.propertyId)?.name ?? ''}` : 'Guardado'} · {CATEGORIES.find((c) => c.id === def.cat)?.name ?? 'Fixo'}</div>
              <div className="row" style={{ gap: 4 }}>
                {!it.locked && <button className="btn sm primary grow" onClick={() => { sfx.click(); onPlace(it.uid); }}>{it.placed ? 'Mover' : 'Colocar'}</button>}
                {it.placed && !it.locked && <button className="btn sm" title="Guardar" onClick={() => act(() => A.storeItem(it.uid))}>Guardar</button>}
                {!it.placed && <button className="btn sm" title="Colocar sozinho num lugar livre" onClick={() => {
                  const spot = findFreeSpot(roomInfo(save), def);
                  if (!spot) { toast('Não há espaço livre para este item. Expanda o ambiente ou guarde algo.', { kind: 'err' }); return; }
                  const ok = act(() => { A.placeItem(it.uid, spot); return true; }); if (ok) { sfx.place(); toast(`${def.name} colocado!`, { kind: 'ok', icon: 'check' }); }
                }}>Auto</button>}
                {!it.locked && !it.gift && def.price > 0 && <button className="btn sm danger" title="Vender" onClick={() => setSell(it.uid)}>$</button>}
              </div>
            </div>
          );
        })}
        {!groups.length && <div className="small muted">Nada aqui. Compre móveis na loja ou guarde itens do ambiente.</div>}
      </div>
      {sell != null && (() => {
        const it = save.game.inventory.find((i) => i.uid === sell); const d = it && getItem(it.defId);
        return d ? <Confirm title="Vender item?" text={<>Vender <b>{d.name}</b> por <Coins n={sellPrice(d)} />? Você recebe metade do preço em moedas virtuais.</>} yes="Vender" danger onClose={() => setSell(null)} onYes={() => { act(() => A.sellItem(sell), 'Vendido'); sfx.coin(); }} /> : null;
      })()}
      {storeAll && <Confirm title="Guardar tudo?" text="Todos os móveis deste imóvel (exceto fixos) vão para o inventário. Dica: salve um layout antes em Imóveis." onClose={() => setStoreAll(false)} onYes={() => act(() => A.storeAll(pid), 'Tudo guardado')} />}
    </Drawer>
  );
}
