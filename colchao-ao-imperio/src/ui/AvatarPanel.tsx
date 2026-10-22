import { useEffect, useRef, useState } from 'react';
import { drawPet, PETS, type PetKind } from '../engine/pet';
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
    <Drawer help="avatar" title="Personagem" icon="person" onClose={onClose} tab={tab} setTab={setTab} tabs={[{ id: 'visual', label: 'Visual' }, { id: 'bichinho', label: 'Bichinho' }, { id: 'titulos', label: 'Títulos' }]}>
      {tab === 'visual' && (
        <>
          <label>Nome</label>
          <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
          <div className="hr" />
          <AvatarEditor value={cfg} onChange={setCfg} ownedCosmetics={save.game.ownedCosmetics} level={progress.level} onBuy={(acc) => { const ok = act(() => { A.buyCosmetic(acc); return true; }, 'Acessório comprado!'); if (ok) sfx.buy(); }} />
          <button className="btn primary block" style={{ marginTop: 12 }} onClick={() => { const ok = act(() => { A.setAvatar(cfg); A.setProfile({ name: name.trim() }); return true; }, 'Visual salvo!'); if (ok) sfx.coin(); }}>Salvar visual</button>
        </>
      )}
      {tab === 'bichinho' && <PetTab save={save} progress={progress} />}
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

function PetPreview({ kind, color }: { kind: PetKind; color: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const loop = () => {
      const c = ref.current; if (!c) return;
      const ctx = c.getContext('2d')!;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.imageSmoothingEnabled = false;
      ctx.setTransform(3, 0, 0, 3, c.width / 2, c.height - 10);
      const t = (performance.now() - t0) / 1000;
      drawPet(ctx, kind, color, t, Math.floor(t / 2) % 2 === 0, false, Math.floor(t / 2) % 2 === 1);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [kind, color]);
  return <canvas ref={ref} width={96} height={80} style={{ imageRendering: 'pixelated', background: 'radial-gradient(circle at 50% 70%, #3a3150, #1a1624)', borderRadius: 6 }} />;
}

function PetTab({ save, progress }: { save: SaveData; progress: Progress }) {
  const cur = save.game.pet;
  const [color, setColor] = useState<Record<string, number>>({});
  const [name, setName] = useState(cur?.name ?? '');
  return (
    <>
      <div className="hint" style={{ marginBottom: 10 }}>Bichinhos são liberados por hábitos reais. Toque nele no quarto para fazer carinho.</div>
      <div className="list">
        {PETS.map((p) => {
          const unlocked = !!progress.achievements.find((a) => a.def.id === p.ach)?.unlocked;
          const c = color[p.id] ?? (cur?.kind === p.id ? cur.color : 0);
          const mine = cur?.kind === p.id;
          return (
            <div key={p.id} className="card row" style={{ alignItems: 'flex-start', opacity: unlocked ? 1 : 0.6, boxShadow: mine ? '0 0 0 2px var(--gold)' : undefined }}>
              <PetPreview kind={p.id} color={c} />
              <div className="grow col" style={{ gap: 6 }}>
                <b>{p.name}{mine ? ` · ${cur!.name}` : ''}</b>
                {unlocked ? (
                  <>
                    <div className="row" style={{ gap: 4 }}>{p.colors.map((col, i) => <button key={col} type="button" aria-label={`Cor ${i + 1}`} onClick={() => setColor({ ...color, [p.id]: i })} style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: col, boxShadow: i === c ? '0 0 0 2px #0e0b14, 0 0 0 4px var(--gold)' : '0 0 0 2px #0e0b14' }} />)}</div>
                    <div className="row">
                      <input value={mine ? name : name || ''} placeholder="Nome" maxLength={20} onChange={(e) => setName(e.target.value)} style={{ padding: '6px 8px' }} />
                      <button className="btn sm primary" onClick={() => act(() => A.setPet({ kind: p.id, color: c, name: name || p.name }), mine ? 'Bichinho atualizado!' : `Você adotou um ${p.name.toLowerCase()}!`)}>{mine ? 'Salvar' : 'Adotar'}</button>
                    </div>
                  </>
                ) : <div className="small muted">Bloqueado: {p.how}.</div>}
              </div>
            </div>
          );
        })}
      </div>
      {cur && <button className="btn sm" style={{ marginTop: 10 }} onClick={() => act(() => A.setPet(null), 'Bichinho foi tirar uma soneca fora do quarto.')}>Deixar sem bichinho</button>}
    </>
  );
}
