import { useState } from 'react';
import type { Progress } from '../game/progress';
import * as A from '../state/actions';
import type { SaveData } from '../state/types';
import { sfx } from '../audio/sfx';
import { AvatarEditor } from './AvatarEditor';
import { act, Drawer, Icon } from './common';

export function AvatarPanel({ save, progress, onClose }: { save: SaveData; progress: Progress; onClose: () => void }) {
  const [tab, setTab] = useState('visual');
  const [cfg, setCfg] = useState(save.profile.avatar);
  const [name, setName] = useState(save.profile.name);
  return (
    <Drawer title="Personagem" icon="person" onClose={onClose} tab={tab} setTab={setTab} tabs={[{ id: 'visual', label: 'Visual' }, { id: 'titulos', label: 'Títulos' }]}>
      {tab === 'visual' && (
        <>
          <label>Nome</label>
          <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
          <div className="hr" />
          <AvatarEditor value={cfg} onChange={setCfg} ownedCosmetics={save.game.ownedCosmetics} level={progress.level} onBuy={(acc) => { const ok = act(() => { A.buyCosmetic(acc); return true; }, 'Acessório comprado!'); if (ok) sfx.buy(); }} />
          <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => { const ok = act(() => { A.setAvatar(cfg); A.setProfile({ name: name.trim() }); return true; }, 'Visual salvo!'); if (ok) sfx.coin(); }}>Salvar visual</button>
        </>
      )}
      {tab === 'titulos' && (
        <div className="list">
          {progress.titles.map((t) => (
            <button key={t.id} className="li" disabled={!t.unlocked} style={{ border: 'none', color: 'inherit', textAlign: 'left', opacity: t.unlocked ? 1 : 0.5, boxShadow: save.profile.titleId === t.id ? '0 0 0 2px var(--gold)' : undefined }} onClick={() => act(() => A.setProfile({ titleId: t.id }))}>
              <Icon name={t.unlocked ? 'star' : 'close'} />
              <div className="grow"><b>{t.name}</b><div className="tiny muted">{t.how}</div></div>
              {save.profile.titleId === t.id && <span className="chip">Usando</span>}
            </button>
          ))}
        </div>
      )}
    </Drawer>
  );
}
