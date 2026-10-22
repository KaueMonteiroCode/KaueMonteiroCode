import { useMemo, useState } from 'react';
import { CATEGORIES, RARITY_INFO, SHOP_ITEMS, type CatId, type ItemDef } from '../game/catalog';
import { STYLE_LIST } from '../game/styles';
import { activeEvents } from '../game/meta';
import type { Progress } from '../game/progress';
import * as A from '../state/actions';
import type { SaveData } from '../state/types';
import { sfx } from '../audio/sfx';
import { act, Coins, Drawer, ItemThumb, Modal, Progress as Bar, StyleThumb, toast } from './common';

type Sort = 'preco' | 'preco-desc' | 'raridade' | 'nome';
const RANK = ['sucata', 'comum', 'incomum', 'raro', 'epico', 'lendario'];

export function ShopPanel({ save, progress, onClose, onPlace }: { save: SaveData; progress: Progress; onClose: () => void; onPlace: (uid: number) => void }) {
  const [cat, setCat] = useState<CatId | 'pisos' | 'paredes-estilo' | 'evento' | 'todos' | 'desejos'>('todos');
  const wish = save.game.wishlist ?? [];
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('preco');
  const [onlyAfford, setOnlyAfford] = useState(false);
  const [detail, setDetail] = useState<ItemDef | null>(null);
  const events = activeEvents();
  const owned = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of save.game.inventory) m.set(i.defId, (m.get(i.defId) ?? 0) + 1);
    return m;
  }, [save]);

  const list = useMemo(() => {
    let l = SHOP_ITEMS.filter((i) => !i.event || events.some((e) => e.id === i.event));
    if (cat === 'evento') l = l.filter((i) => i.event);
    else if (cat === 'desejos') l = l.filter((i) => wish.includes(i.id));
    else if (cat !== 'todos') l = l.filter((i) => i.cat === cat);
    if (q.trim()) l = l.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));
    if (onlyAfford) l = l.filter((i) => i.price <= progress.coins && (!i.minLevel || i.minLevel <= progress.level));
    const s = [...l];
    if (sort === 'preco') s.sort((a, b) => a.price - b.price);
    if (sort === 'preco-desc') s.sort((a, b) => b.price - a.price);
    if (sort === 'raridade') s.sort((a, b) => RANK.indexOf(b.rarity) - RANK.indexOf(a.rarity));
    if (sort === 'nome') s.sort((a, b) => a.name.localeCompare(b.name));
    return s;
  }, [cat, q, sort, onlyAfford, progress, events, wish]);

  const buy = (def: ItemDef, place: boolean) => {
    const uid = act(() => A.buyItem(def.id));
    if (uid == null) return;
    sfx.buy();
    toast(`Comprado: ${def.name}`, { kind: 'ok', icon: 'shop', sub: <>-<Coins n={def.price} /> moedas virtuais · R$ 0,00 do seu dinheiro real</> });
    setDetail(null);
    if (place) onPlace(uid);
  };

  const styles = cat === 'pisos' ? STYLE_LIST.filter((s) => s.kind === 'floor') : cat === 'paredes-estilo' ? STYLE_LIST.filter((s) => s.kind === 'wall') : null;
  const room = save.game.rooms[save.game.currentProperty];

  return (
    <Drawer title="Loja de móveis" icon="shop" onClose={onClose} wide>
      <div className="row wrap between" style={{ marginBottom: 8 }}>
        <div className="small">Saldo: <Coins n={progress.coins} className="gold" /> <span className="muted tiny">(moedas virtuais)</span></div>
        <div className="row">
          <input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 150, padding: '6px 8px' }} />
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ width: 'auto', padding: '6px 8px' }}>
            <option value="preco">Mais baratos</option><option value="preco-desc">Mais caros</option><option value="raridade">Raridade</option><option value="nome">Nome</option>
          </select>
        </div>
      </div>
      <div className="catbar">
        <button className={`btn sm ${cat === 'todos' ? 'gold' : ''}`} onClick={() => setCat('todos')}>Tudo</button>
        <button className={`btn sm ${cat === 'desejos' ? 'gold' : ''}`} onClick={() => setCat('desejos')}>★ Desejos ({wish.length})</button>
        {events.length > 0 && <button className={`btn sm ${cat === 'evento' ? 'gold' : ''}`} onClick={() => setCat('evento')} style={{ color: cat === 'evento' ? undefined : events[0].color }}>★ Evento</button>}
        {CATEGORIES.map((c) => <button key={c.id} className={`btn sm ${cat === c.id ? 'gold' : ''}`} onClick={() => setCat(c.id)}>{c.name}</button>)}
        <button className={`btn sm ${cat === 'pisos' ? 'gold' : ''}`} onClick={() => setCat('pisos')}>Pisos</button>
        <button className={`btn sm ${cat === 'paredes-estilo' ? 'gold' : ''}`} onClick={() => setCat('paredes-estilo')}>Papéis de parede</button>
      </div>
      {!styles && <WishProgress save={save} coins={progress.coins} onOpen={(d) => setDetail(d)} />}
      {!styles && <label className="row small" style={{ margin: '0 0 8px' }}><input type="checkbox" checked={onlyAfford} onChange={(e) => setOnlyAfford(e.target.checked)} style={{ width: 'auto' }} /> Só o que posso comprar agora</label>}

      {styles ? (
        <div className="items-grid">
          {styles.map((st) => {
            const has = save.game.ownedStyles.includes(st.id);
            const inUse = room.floor === st.id || room.wall === st.id;
            const lock = st.minLevel && progress.level < st.minLevel;
            return (
              <button key={st.id} className={`item-card ${inUse ? 'sel' : ''}`} onClick={() => {
                if (lock) return;
                const ok = act(() => { A.buyStyle(st.id); return true; });
                if (ok) { sfx.buy(); toast(has ? `Aplicado: ${st.name}` : `Reforma feita: ${st.name}`, { kind: 'ok', icon: 'brush' }); }
              }}>
                <StyleThumb styleId={st.id} />
                <div className="nm">{st.name}</div>
                <div className="row between"><span className="pr">{has ? (inUse ? 'Em uso' : 'Aplicar') : <Coins n={st.price} />}</span><span className="tag-rare" style={{ background: RARITY_INFO[st.rarity].color }}>{RARITY_INFO[st.rarity].name}</span></div>
                {lock && <div className="locked">Nível {st.minLevel}</div>}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="items-grid">
          {list.map((def) => {
            const lock = def.minLevel && progress.level < def.minLevel;
            const n = owned.get(def.id) ?? 0;
            return (
              <button key={def.id} className="item-card" onClick={() => { sfx.click(); setDetail(def); }}>
                <ItemThumb defId={def.id} />
                {n > 0 && <span className="qty">x{n}</span>}
                {wish.includes(def.id) && <span className="qty" style={{ left: 8, right: 'auto', color: 'var(--gold)' }} aria-label="Na lista de desejos">★</span>}
                <div className="nm">{def.name}</div>
                <div className="row between">
                  <span className="pr" style={{ color: def.price > progress.coins ? 'var(--ink-3)' : undefined }}>{def.price === 0 ? 'Grátis' : <Coins n={def.price} />}</span>
                  <span className="tag-rare" style={{ background: RARITY_INFO[def.rarity].color }}>{RARITY_INFO[def.rarity].name}</span>
                </div>
                {lock && <div className="locked">Nível {def.minLevel}</div>}
              </button>
            );
          })}
          {!list.length && <div className="muted small">Nada por aqui com esses filtros.</div>}
        </div>
      )}
      <div className="tiny muted" style={{ marginTop: 12 }}>{SHOP_ITEMS.length} móveis e variantes + {STYLE_LIST.length} pisos e paredes. Compras usam só moedas virtuais.</div>

      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 150 }}><ItemThumb defId={detail.id} size={150} animate className="thumb" /></div>
            <div className="grow col small" style={{ gap: 6 }}>
              <div><span className="tag-rare" style={{ background: RARITY_INFO[detail.rarity].color }}>{RARITY_INFO[detail.rarity].name}</span></div>
              <div className="muted">{CATEGORIES.find((c) => c.id === detail.cat)?.name} · {detail.place === 'wall' ? `parede, ${detail.w} de largura` : `${detail.w}x${detail.d} tiles`}{detail.place === 'top' ? ' · vai em cima de mesas' : ''}</div>
              {detail.desc && <div style={{ fontStyle: 'italic' }}>"{detail.desc}"</div>}
              {detail.sit != null && <div>Dá para sentar.</div>}
              {detail.sleep != null && <div>Dá para dormir.</div>}
              {detail.use && <div>Interativo.</div>}
              {detail.light && <div>Ilumina o ambiente.</div>}
              {detail.collection && <div className="gold">Parte de uma coleção.</div>}
              {detail.minLevel && <div>Requer nível {detail.minLevel}.</div>}
              <div className="hr" />
              <div>Preço: <Coins n={detail.price} className="gold" /></div>
              <div className="tiny muted">Seu saldo: <Coins n={progress.coins} /> · Você tem {owned.get(detail.id) ?? 0}</div>
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn ghost" onClick={() => act(() => A.toggleWish(detail.id))}>{wish.includes(detail.id) ? '★ Tirar dos desejos' : '☆ Quero este'}</button>
            <button className="btn" disabled={detail.price > progress.coins || (detail.minLevel ?? 0) > progress.level} onClick={() => buy(detail, false)}>Comprar e guardar</button>
            <button className="btn gold" disabled={detail.price > progress.coins || (detail.minLevel ?? 0) > progress.level} onClick={() => buy(detail, true)}>Comprar e posicionar</button>
          </div>
          {detail.price > progress.coins && <div className="small muted" style={{ marginTop: 8 }}>Faltam <Coins n={detail.price - progress.coins} />. Registre economias para ganhar mais moedas.</div>}
        </Modal>
      )}
    </Drawer>
  );
}

/** Próximo desejo: o item mais barato da lista que ainda não dá para comprar (ou um que já dá). */
export function WishProgress({ save, coins, onOpen }: { save: SaveData; coins: number; onOpen?: (d: ItemDef) => void }) {
  const items = (save.game.wishlist ?? []).map((id) => SHOP_ITEMS.find((i) => i.id === id)).filter((x): x is ItemDef => !!x).sort((a, b) => a.price - b.price);
  if (!items.length) return null;
  const ready = items.filter((i) => i.price <= coins);
  const next = items.find((i) => i.price > coins);
  return (
    <div className="card row" style={{ marginBottom: 10, gap: 10, cursor: onOpen ? 'pointer' : undefined }} onClick={() => onOpen?.((next ?? ready[0]))}>
      <div style={{ width: 56, flexShrink: 0 }}><ItemThumb defId={(next ?? ready[0]).id} size={56} /></div>
      <div className="grow" style={{ minWidth: 0 }}>
        {ready.length > 0 && <div className="small pos">Você já pode comprar {ready.length === 1 ? ready[0].name : `${ready.length} desejos`}!</div>}
        {next && <>
          <div className="small ellipsis">Próximo desejo: <b>{next.name}</b></div>
          <Bar value={coins} max={next.price} kind="gold" />
          <div className="tiny muted">Faltam <Coins n={next.price - coins} /> moedas</div>
        </>}
      </div>
    </div>
  );
}
