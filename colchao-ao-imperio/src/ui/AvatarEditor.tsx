import { useEffect, useRef, useState } from 'react';
import {
  ACCESSORIES, BEARDS, CLOTH_COLORS, EYES, HAIR_COLORS, HAIR_STYLES, MOUTHS, PANTS, PREMIUM_ACCESSORIES, SHIRTS, SKIN,
  renderAvatarPreview, type AvatarAnim,
} from '../engine/avatar';
import type { AvatarConfig } from '../state/types';
import { Coins, Icon } from './common';

export function AvatarPreview({ cfg, anim = 'idle', dir = 0, w = 120, h = 150, scale = 3 }: { cfg: AvatarConfig; anim?: AvatarAnim; dir?: number; w?: number; h?: number; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const loop = () => { if (ref.current) renderAvatarPreview(ref.current, cfg, { dir, anim, t: (performance.now() - t0) / 1000 }, scale); raf = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [cfg, anim, dir, scale]);
  return <canvas ref={ref} width={w} height={h} style={{ imageRendering: 'pixelated', background: 'radial-gradient(circle at 50% 70%, #3a3150, #1a1624)', borderRadius: 6 }} />;
}

function Picker({ label, n, value, onChange, names, colors }: { label: string; n: number; value: number; onChange: (v: number) => void; names?: string[]; colors?: string[] }) {
  return (
    <div>
      <label>{label}{names ? `: ${names[value]}` : ''}</label>
      {colors ? (
        <div className="row wrap" style={{ gap: 4 }}>
          {colors.map((c, i) => (
            <button key={i} type="button" aria-label={`${label} ${i + 1}`} onClick={() => onChange(i)} style={{ width: 26, height: 26, borderRadius: 4, border: 'none', background: c, boxShadow: i === value ? '0 0 0 2px #0e0b14, 0 0 0 4px var(--gold)' : '0 0 0 2px #0e0b14' }} />
          ))}
        </div>
      ) : (
        <div className="row">
          <button type="button" className="btn sm" onClick={() => onChange((value - 1 + n) % n)}>◀</button>
          <div className="grow small" style={{ textAlign: 'center' }}>{names?.[value] ?? value + 1}</div>
          <button type="button" className="btn sm" onClick={() => onChange((value + 1) % n)}>▶</button>
        </div>
      )}
    </div>
  );
}

export function AvatarEditor({ value, onChange, ownedCosmetics, onBuy, level }: { value: AvatarConfig; onChange: (a: AvatarConfig) => void; ownedCosmetics: string[]; onBuy?: (acc: number) => void; level: number }) {
  const [anim, setAnim] = useState<AvatarAnim>('idle');
  const [dir, setDir] = useState(0);
  const set = (k: keyof AvatarConfig) => (v: number) => onChange({ ...value, [k]: v });
  return (
    <div className="row wrap" style={{ alignItems: 'flex-start', gap: 14 }}>
      <div className="col" style={{ alignItems: 'center' }}>
        <AvatarPreview cfg={value} anim={anim} dir={dir} w={130} h={160} scale={3} />
        <div className="row">
          <button type="button" className="btn sm icon" aria-label="Girar" onClick={() => setDir((dir + 1) % 4)}><Icon name="rotate" /></button>
          <select value={anim} onChange={(e) => setAnim(e.target.value as AvatarAnim)} style={{ width: 'auto', padding: '4px 6px', fontSize: 12 }}>
            <option value="idle">Parado</option><option value="walk">Andando</option><option value="sit">Sentado</option><option value="type">Digitando</option>
            <option value="celebrate">Comemorando</option><option value="sleep">Dormindo</option><option value="drink">Tomando café</option>
          </select>
        </div>
      </div>
      <div className="grow" style={{ minWidth: 220 }}>
        <Picker label="Pele" n={SKIN.length} value={value.skin} onChange={set('skin')} colors={SKIN} />
        <Picker label="Cabelo" n={HAIR_STYLES.length} value={value.hairStyle} onChange={set('hairStyle')} names={HAIR_STYLES} />
        <Picker label="Cor do cabelo" n={HAIR_COLORS.length} value={value.hairColor} onChange={set('hairColor')} colors={HAIR_COLORS} />
        <div className="grid2">
          <Picker label="Olhos" n={EYES.length} value={value.eyes} onChange={set('eyes')} names={EYES} />
          <Picker label="Boca" n={MOUTHS.length} value={value.mouth} onChange={set('mouth')} names={MOUTHS} />
        </div>
        <Picker label="Barba" n={BEARDS.length} value={value.beard} onChange={set('beard')} names={BEARDS} />
        <Picker label="Roupa" n={SHIRTS.length} value={value.shirtStyle} onChange={set('shirtStyle')} names={SHIRTS} />
        <Picker label="Cor da roupa" n={CLOTH_COLORS.length} value={value.shirtColor} onChange={set('shirtColor')} colors={CLOTH_COLORS} />
        <Picker label="Parte de baixo" n={PANTS.length} value={value.pantsStyle} onChange={set('pantsStyle')} names={PANTS} />
        <Picker label="Cor" n={CLOTH_COLORS.length} value={value.pantsColor} onChange={set('pantsColor')} colors={CLOTH_COLORS} />
        <Picker label="Sapatos" n={CLOTH_COLORS.length} value={value.shoesColor} onChange={set('shoesColor')} colors={CLOTH_COLORS} />
        <label>Acessório</label>
        <div className="col" style={{ gap: 4 }}>
          {ACCESSORIES.map((name, i) => {
            const prem = PREMIUM_ACCESSORIES[i];
            const owned = !prem || ownedCosmetics.includes(`acc-${i}`);
            return (
              <div key={i} className="row" style={{ background: i === value.accessory ? 'var(--panel-3)' : 'transparent', borderRadius: 4, padding: '2px 6px' }}>
                <button type="button" className="btn ghost sm grow" style={{ justifyContent: 'flex-start' }} disabled={!owned} onClick={() => set('accessory')(i)}>
                  {i === value.accessory ? '● ' : '○ '}{name}
                </button>
                {!owned && prem && (
                  level >= prem.minLevel
                    ? <button type="button" className="btn gold sm" onClick={() => onBuy?.(i)}><Coins n={prem.price} /></button>
                    : <span className="tiny muted">nível {prem.minLevel}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
