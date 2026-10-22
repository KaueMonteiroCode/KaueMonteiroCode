import { useMemo, useState } from 'react';
import { formatBRL } from '../core/money';
import { GROUPS, TIER_COLORS, TIER_NAMES, type AchGroup } from '../game/achievements';
import type { Progress } from '../game/progress';
import { COLLECTIONS, collectionItems } from '../game/catalog';
import type { SaveData } from '../state/types';
import { Coins, Drawer, Icon, ItemThumb, Progress as Bar } from './common';

export function AchievementsPanel({ save, progress, onClose }: { save: SaveData; progress: Progress; onClose: () => void }) {
  const [tab, setTab] = useState('lista');
  const [group, setGroup] = useState<AchGroup | 'todos'>('todos');
  const [show, setShow] = useState<'todas' | 'feitas' | 'faltam'>('todas');
  const owned = useMemo(() => new Set(save.game.inventory.map((i) => i.defId)), [save]);
  const list = progress.achievements.filter((a) => (group === 'todos' || a.def.group === group) && (show === 'todas' || (show === 'feitas' ? a.unlocked : !a.unlocked)));
  const fmt = (a: (typeof list)[number], v: number) => (a.def.money ? formatBRL(v) : String(Math.min(v, a.target)));

  return (
    <Drawer help="achievements" title="Conquistas" icon="trophy" onClose={onClose} wide tab={tab} setTab={setTab} tabs={[{ id: 'lista', label: 'Lista' }, { id: 'arvore', label: 'Árvore' }, { id: 'colecoes', label: 'Coleções' }, { id: 'evolucao', label: 'Evolução' }]}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="small"><b className="gold">{progress.unlockedCount}</b> de {progress.achievements.length} desbloqueadas</div>
        <div style={{ width: 160 }}><Bar value={progress.unlockedCount} max={progress.achievements.length} kind="gold" /></div>
      </div>
      {tab === 'lista' && (
        <>
          <div className="catbar">
            <button className={`btn sm ${group === 'todos' ? 'gold' : ''}`} onClick={() => setGroup('todos')}>Todas</button>
            {(Object.keys(GROUPS) as AchGroup[]).map((g) => <button key={g} className={`btn sm ${group === g ? 'gold' : ''}`} onClick={() => setGroup(g)}>{GROUPS[g].name}</button>)}
          </div>
          <div className="seg" style={{ marginBottom: 10 }}>
            {(['todas', 'feitas', 'faltam'] as const).map((s) => <button key={s} className={show === s ? 'on' : ''} onClick={() => setShow(s)}>{s === 'todas' ? 'Todas' : s === 'feitas' ? 'Desbloqueadas' : 'Pendentes'}</button>)}
          </div>
          <div className="list">
            {list.map((a) => (
              <div key={a.def.id} className="li" style={{ opacity: a.unlocked ? 1 : 0.75, boxShadow: a.unlocked ? `0 0 0 2px ${TIER_COLORS[a.def.tier]}` : undefined }}>
                <Icon name={a.unlocked ? 'trophy' : 'star'} size={24} />
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{a.def.name} <span className="tag-rare" style={{ background: TIER_COLORS[a.def.tier] }}>{TIER_NAMES[a.def.tier]}</span></div>
                  <div className="small muted">{a.def.desc}</div>
                  {!a.unlocked && <div style={{ marginTop: 4 }}><Bar value={a.cur} max={a.target} /><div className="tiny muted">{fmt(a, a.cur)} / {fmt(a, a.target)}</div></div>}
                  {a.unlocked && save.game.seenAchievements[a.def.id] && <div className="tiny muted">Desbloqueada em {new Date(save.game.seenAchievements[a.def.id]).toLocaleDateString('pt-BR')}</div>}
                </div>
                <div className="col" style={{ alignItems: 'flex-end' }}><Coins n={a.coins} className={a.unlocked ? 'gold' : 'muted'} />{a.def.xp > 0 && <span className="tiny muted">{a.def.xp} XP</span>}</div>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === 'arvore' && (
        <>
          <div className="small muted" style={{ marginBottom: 8 }}>Cada coluna é um ramo. Siga de cima para baixo: o próximo marco só acende depois do anterior.</div>
          <div className="tree">
            {(Object.keys(GROUPS) as AchGroup[]).map((g) => {
              const nodes = progress.achievements.filter((a) => a.def.group === g);
              return (
                <div key={g} className="tree-col">
                  <div className="pix" style={{ fontSize: 9, color: GROUPS[g].color, marginBottom: 6, textAlign: 'center' }}>{GROUPS[g].name}</div>
                  {nodes.map((a, i) => (
                    <div key={a.def.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      {i > 0 && <div className={`tree-link ${a.unlocked ? 'on' : ''}`} />}
                      <div className={`tree-node ${a.unlocked ? 'on' : ''}`} title={a.def.desc}>
                        {a.def.name}
                        {!a.unlocked && <div style={{ marginTop: 3 }}><Bar value={a.cur} max={a.target} /></div>}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}
      {tab === 'colecoes' && (
        <div className="list">
          {COLLECTIONS.map((c) => {
            const items = collectionItems(c.id);
            const have = items.filter((i) => owned.has(i.id)).length;
            return (
              <div key={c.id} className="card">
                <div className="row between"><b>{c.name}</b><span className="small">{have}/{items.length} · bônus <Coins n={c.bonusCoins} /></span></div>
                <div className="small muted">{c.desc}</div>
                <div className="row wrap" style={{ marginTop: 6, gap: 4 }}>
                  {items.map((i) => <div key={i.id} title={i.name} style={{ width: 52, opacity: owned.has(i.id) ? 1 : 0.3 }}><ItemThumb defId={i.id} size={52} /></div>)}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {tab === 'evolucao' && (
        <>
          <div className="card">
            <b>De onde vieram suas moedas e XP</b>
            <table className="tbl" style={{ marginTop: 6 }}>
              <thead><tr><th>Fonte</th><th className="r">Moedas</th><th className="r">XP</th></tr></thead>
              <tbody>
                {progress.breakdown.map((b) => <tr key={b.label}><td>{b.label}</td><td className="r">{b.coins}</td><td className="r">{b.xp}</td></tr>)}
                <tr><td>Gastos/vendas na loja</td><td className="r">{progress.coinsSpentNet}</td><td className="r">—</td></tr>
                <tr><td><b>Saldo</b></td><td className="r"><b>{progress.coins}</b></td><td className="r"><b>{progress.xp}</b></td></tr>
              </tbody>
            </table>
            <div className="tiny muted" style={{ marginTop: 6 }}>Moedas são recalculadas a partir do seu histórico: corrigir ou excluir lançamentos ajusta o valor, nunca duplica.</div>
          </div>
          <div className="card">
            <b>Histórico de evolução</b>
            <div className="list" style={{ marginTop: 6 }}>
              {Object.entries(save.game.seenAchievements).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([id, at]) => {
                const a = progress.achievements.find((x) => x.def.id === id);
                return a ? <div key={id} className="row small"><span className="muted nowrap">{new Date(at).toLocaleDateString('pt-BR')}</span><span className="grow ellipsis">{a.def.name}</span>{!a.unlocked && <span className="tiny neg">revogada após correção</span>}</div> : null;
              })}
              {Object.values(save.game.claims).sort((a, b) => b.at - a.at).slice(0, 20).map((c) => <div key={c.at + c.label} className="row small"><span className="muted nowrap">{new Date(c.at).toLocaleDateString('pt-BR')}</span><span className="grow ellipsis">Resgate: {c.label}</span><Coins n={c.coins} /></div>)}
            </div>
          </div>
          <div className="card">
            <b>Objetivos</b>
            {(['curto', 'medio', 'longo'] as const).map((h) => {
              const pend = progress.achievements.filter((a) => !a.unlocked && a.def.group !== 'nivel').map((a) => ({ a, pct: a.cur / a.target })).sort((x, y) => y.pct - x.pct);
              const pick = h === 'curto' ? pend.slice(0, 3) : h === 'medio' ? pend.filter((p) => p.pct < 0.5 && p.pct >= 0.1).slice(0, 3) : pend.filter((p) => p.a.def.tier >= 5).slice(0, 3);
              return (
                <div key={h} style={{ marginTop: 8 }}>
                  <div className="tiny muted">{h === 'curto' ? 'Curto prazo (quase lá)' : h === 'medio' ? 'Médio prazo' : 'Longo prazo (lendários)'}</div>
                  {pick.map(({ a }) => <div key={a.def.id} className="row small" style={{ marginTop: 4 }}><span className="grow ellipsis">{a.def.name}</span><div style={{ width: 90 }}><Bar value={a.cur} max={a.target} /></div></div>)}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Drawer>
  );
}
