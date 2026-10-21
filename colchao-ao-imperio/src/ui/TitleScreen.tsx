import { useEffect, useMemo, useRef } from 'react';
import { GameEngine } from '../engine/engine';
import { newSave } from '../state/defaults';
import { AvatarPreview } from './AvatarEditor';
import type { SaveData } from '../state/types';

export function TitleScreen({ save, onNew, onContinue }: { save: SaveData | null; onNew: () => void; onContinue: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const demo = useMemo(() => newSave(), []);
  useEffect(() => {
    if (!ref.current) return;
    const e = new GameEngine(ref.current);
    e.setSave(save ?? demo);
    const id = setInterval(() => { if (!e.player.path.length) e.walkTo(Math.floor(Math.random() * 4), Math.floor(Math.random() * 4)); }, 3500);
    setTimeout(() => e.fit(true), 50);
    return () => { clearInterval(id); e.destroy(); };
  }, [save, demo]);
  const stars = useMemo(() => Array.from({ length: 60 }, (_, i) => ({ l: (i * 37) % 100, t: (i * 53) % 100, d: (i % 7) * 0.4 })), []);
  return (
    <div className="title-screen">
      <div className="stars">{stars.map((s, i) => <i key={i} style={{ left: `${s.l}%`, top: `${s.t}%`, animationDelay: `${s.d}s` }} />)}</div>
      <div className="col" style={{ alignItems: 'center', gap: 18, position: 'relative', width: 'min(720px, 100%)' }}>
        <div className="title-logo">DO COLCHÃO<br />AO IMPÉRIO</div>
        <div className="title-sub">FINANCE TYCOON · seu dinheiro de verdade<br />constrói seu império de mentirinha</div>
        <div style={{ width: '100%', height: 'min(46vh, 360px)', position: 'relative', borderRadius: 8, overflow: 'hidden', boxShadow: '0 0 0 3px #0e0b14' }}>
          <canvas ref={ref} style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated', pointerEvents: 'none' }} />
        </div>
        <div className="row wrap" style={{ justifyContent: 'center' }}>
          {save?.profile.onboarded && (
            <button className="btn gold" style={{ fontSize: 15, padding: '12px 22px' }} onClick={onContinue} autoFocus>
              ▶ Continuar{save.profile.name ? ` como ${save.profile.name}` : ''}
            </button>
          )}
          {save && !save.profile.onboarded && <button className="btn gold" style={{ fontSize: 15, padding: '12px 22px' }} onClick={onContinue}>▶ Continuar introdução</button>}
          {!save && <button className="btn gold" style={{ fontSize: 15, padding: '12px 22px' }} onClick={onNew} autoFocus>▶ Novo jogo</button>}
        </div>
        {save?.profile.onboarded && (
          <div className="row small muted"><AvatarPreview cfg={save.profile.avatar} w={48} h={60} scale={1} /> Seus dados ficam só neste navegador.</div>
        )}
        {!save && <div className="small muted" style={{ textAlign: 'center', maxWidth: 460, lineHeight: 1.6 }}>Sem cadastro, sem senha de banco, sem internet obrigatória. Tudo fica salvo localmente no seu navegador.</div>}
      </div>
    </div>
  );
}
