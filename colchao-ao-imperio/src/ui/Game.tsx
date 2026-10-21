import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameEngine, type EngineMode, type PlaceState } from '../engine/engine';
import { getItem, sellPrice } from '../game/catalog';
import { ACH_BY_ID } from '../game/achievements';
import { computeProgress } from '../game/progress';
import { currentMissions } from '../game/missions';
import { activeEvents } from '../game/meta';
import { formatBRL } from '../core/money';
import { totals } from '../finance/ledger';
import * as A from '../state/actions';
import type { Placement, SaveData } from '../state/types';
import { getState } from '../state/store';
import { setMusic, setSoundEnabled, sfx } from '../audio/sfx';
import { act, Coins, Confirm, Icon, toast, Toasts } from './common';
import { AvatarPreview } from './AvatarEditor';
import { Onboarding } from './Onboarding';
import { SavingDialog } from './SavingDialog';
import { ShopPanel } from './Shop';
import { InventoryPanel } from './Inventory';
import { FinancePanel } from './finance/FinancePanel';
import { MissionsPanel } from './Missions';
import { AchievementsPanel } from './Achievements';
import { PropertiesPanel } from './Properties';
import { AvatarPanel } from './AvatarPanel';
import { SettingsPanel } from './Settings';

export type PanelId = 'finance' | 'shop' | 'inventory' | 'missions' | 'achievements' | 'properties' | 'avatar' | 'settings';

export function Game({ save, onExit }: { save: SaveData; onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [financeTab, setFinanceTab] = useState<string>('resumo');
  const [mode, setModeState] = useState<EngineMode>('play');
  const [placing, setPlacing] = useState<PlaceState | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmSell, setConfirmSell] = useState<number | null>(null);
  const afterPlace = useRef<EngineMode>('play');
  const progress = useMemo(() => computeProgress(save), [save]);
  const tot = useMemo(() => totals(save.finance), [save]);

  /* ---------- engine ---------- */
  useEffect(() => {
    const e = new GameEngine(canvasRef.current!);
    engineRef.current = e;
    (window as unknown as { __engine?: GameEngine }).__engine = e; // usado pelo teste e2e
    e.setSave(save);
    setTimeout(() => e.fit(true), 30);
    const onResize = () => e.fit();
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); e.destroy(); engineRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { engineRef.current?.setSave(save); }, [save]);
  useEffect(() => { setSoundEnabled(save.settings.sound); setMusic(save.settings.music); }, [save.settings.sound, save.settings.music]);

  const setMode = useCallback((m: EngineMode, place?: PlaceState) => {
    engineRef.current?.setMode(m, place);
    setModeState(m);
    setPlacing(m === 'place' ? place ?? null : null);
    if (m !== 'edit') setSelected(null);
  }, []);

  const startPlacing = useCallback((uid: number, back: EngineMode = 'play') => {
    const it = getState().game.inventory.find((i) => i.uid === uid);
    if (!it) return;
    const def = getItem(it.defId)!;
    afterPlace.current = back;
    setPanel(null);
    setMode('place', { uid, defId: it.defId, rot: it.placed?.rot ?? (def.place === 'wall' ? 1 : 0) });
    toast(`Escolha onde colocar: ${def.name}`, { icon: 'hammer', sub: 'Toque/clique no ambiente. R ou o botão Girar para rotacionar.' });
  }, [setMode]);

  useEffect(() => {
    const e = engineRef.current;
    if (!e) return;
    e.cb = {
      onPlace: (p: Placement, pl: PlaceState) => {
        if (pl.uid == null) return;
        const ok = act(() => { A.placeItem(pl.uid!, p); return true; });
        if (ok) { sfx.place(); setMode(afterPlace.current); }
      },
      onPlaceInvalid: (r) => { sfx.error(); toast(r, { kind: 'err' }); },
      onSelect: (uid) => { sfx.click(); setSelected(uid); },
      onUse: (def) => { if (def.use === 'computer') { setFinanceTab('resumo'); setPanel('finance'); A.visit('fin'); } },
      onHint: (t) => toast(t),
    };
  }, [setMode]);

  /* ---------- câmera abre espaço para os painéis ---------- */
  useEffect(() => {
    const e = engineRef.current; if (!e) return;
    const upd = () => {
      const w = window.innerWidth;
      if (!panel) e.setInset(0, 0);
      else if (w <= 720) e.setInset(0, window.innerHeight * 0.86);
      else e.setInset(Math.min(panel === 'shop' || panel === 'finance' || panel === 'inventory' || panel === 'achievements' ? 760 : 480, w), 0);
    };
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, [panel]);

  /* ---------- notificações de conquista / nível / moedas ---------- */
  const lastCoins = useRef<number | null>(null);
  const notified = useRef<Set<string>>(new Set());
  const notifiedLevel = useRef(0);
  useEffect(() => {
    const p = progress;
    if (lastCoins.current != null && p.coinsEarned > lastCoins.current) {
      const delta = p.coinsEarned - lastCoins.current;
      engineRef.current?.coinBurst(delta);
      sfx.coin();
    }
    lastCoins.current = p.coinsEarned;
    if (!save.profile.onboarded) return;
    const fresh = p.achievements.filter((a) => a.unlocked && !save.game.seenAchievements[a.def.id] && !notified.current.has(a.def.id));
    const levelUp = p.level > Math.max(save.game.seenLevel, notifiedLevel.current);
    fresh.forEach((a) => notified.current.add(a.def.id));
    if (levelUp) notifiedLevel.current = p.level;
    if (!fresh.length && !levelUp) return;
    const show = fresh.slice(0, 3);
    show.forEach((a, i) => setTimeout(() => toast(`Conquista: ${a.def.name}`, { kind: 'ach', icon: 'trophy', sub: <>+<Coins n={a.coins} /> · {a.def.desc}</> }), i * 500));
    if (fresh.length > 3) setTimeout(() => toast(`E mais ${fresh.length - 3} conquistas!`, { kind: 'ach', icon: 'star' }), 1600);
    if (levelUp) setTimeout(() => { toast(`Subiu para o nível ${p.level}!`, { kind: 'ach', icon: 'star', sub: 'Novos itens e títulos podem ter sido liberados.' }); sfx.levelUp(); }, show.length * 500);
    const big = fresh.find((a) => a.def.group === 'dividas') ?? fresh[0];
    engineRef.current?.celebrate(big ? (big.def.group === 'dividas' ? 'DÍVIDA A MENOS!!!' : 'Conquista desbloqueada!') : `Nível ${p.level}!`);
    sfx.achievement();
    // marca como visto (sem disparar de novo)
    setTimeout(() => A.markSeen(fresh.map((a) => a.def.id), p.level), 50);
  }, [progress, save]);

  const missionsReady = useMemo(() => currentMissions(save).filter((m) => m.done && !m.claimed).length, [save]);
  const events = activeEvents();
  const sel = selected != null ? save.game.inventory.find((i) => i.uid === selected) : null;
  const selDef = sel ? getItem(sel.defId) : null;

  const openPanel = (p: PanelId) => {
    sfx.open();
    if (panel === p) { setPanel(null); return; }
    if (mode !== 'play') setMode('play');
    setPanel(p);
    if (p === 'finance') A.visit('fin');
  };

  const title = progress.titles.find((t) => t.id === save.profile.titleId && t.unlocked)?.name ?? progress.titles[0].name;

  return (
    <div className="app">
      <div className="canvas-wrap"><canvas ref={canvasRef} aria-label="Ambiente do jogo" /></div>

      {/* HUD superior */}
      <div className="hud-top">
        <button className="hud-box hud-player" style={{ border: 'none', color: 'inherit', textAlign: 'left' }} onClick={() => openPanel('avatar')} aria-label="Personagem">
          <AvatarPreview cfg={save.profile.avatar} w={40} h={48} scale={0.85} />
          <div style={{ minWidth: 120 }}>
            <div className="ellipsis" style={{ fontWeight: 700 }}>{save.profile.name || 'Jogador'}</div>
            <div className="tiny muted ellipsis">{title}</div>
            <div className="row" style={{ gap: 6, marginTop: 3 }}>
              <span className="pix" style={{ fontSize: 9, color: 'var(--purple)' }}>NV {progress.level}</span>
              <div className="xpbar grow" title={`${progress.levelInfo.into}/${progress.levelInfo.span} XP`}><div style={{ width: `${(progress.levelInfo.into / Math.max(1, progress.levelInfo.span)) * 100}%` }} /></div>
            </div>
          </div>
        </button>
        <div className="hud-box hud-stat" title="Moedas virtuais (só para a loja do jogo)">
          <span className="lbl">Moedas</span>
          <span className="val gold"><Coins n={progress.coins} /></span>
        </div>
        <button className="hud-box hud-stat" style={{ border: 'none', color: 'inherit', textAlign: 'left' }} onClick={() => openPanel('finance')} title="Patrimônio líquido real (ativos - dívidas)">
          <span className="lbl">Patrimônio real</span>
          <span className={`val ${tot.netWorth >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 11 }}>{formatBRL(tot.netWorth, { compact: true })}</span>
        </button>
        <div className="grow" />
        {events.map((ev) => <div key={ev.id} className="hud-box tiny hud-hide-sm" style={{ color: ev.color, maxWidth: 200 }}><b>EVENTO</b><br />{ev.name}</div>)}
        <button className="hud-box btn icon" onClick={() => A.setSettings({ sound: !save.settings.sound })} aria-label="Som" title={save.settings.sound ? 'Som ligado' : 'Som desligado'} style={{ opacity: save.settings.sound ? 1 : 0.45 }}><Icon name="sound" /></button>
      </div>

      {/* zoom */}
      <div className="zoombar">
        <button className="btn icon" aria-label="Aproximar" onClick={() => engineRef.current?.zoomBy(1.2)}><Icon name="zin" /></button>
        <button className="btn icon" aria-label="Afastar" onClick={() => engineRef.current?.zoomBy(1 / 1.2)}><Icon name="zout" /></button>
        <button className="btn icon" aria-label="Ver ambiente inteiro" onClick={() => engineRef.current?.fit()}><Icon name="fit" /></button>
      </div>

      {/* barra do editor */}
      {mode === 'edit' && (
        <div className="editbar">
          {sel && selDef ? (
            <>
              <div className="small" style={{ alignSelf: 'center', maxWidth: 180 }}><b className="ellipsis" style={{ display: 'block' }}>{selDef.name}</b>{sel.locked && <span className="tiny muted">fixo do imóvel</span>}</div>
              {!sel.locked && <button className="btn sm" onClick={() => startPlacing(sel.uid, 'edit')}><Icon name="hammer" />Mover</button>}
              {!sel.locked && <button className="btn sm" onClick={() => { const r = selDef.place === 'wall' ? 1 - sel.placed!.rot : (sel.placed!.rot + 1) % 4; act(() => A.placeItem(sel.uid, { ...sel.placed!, rot: r })); sfx.place(); }}><Icon name="rotate" />Girar</button>}
              {!sel.locked && <button className="btn sm" onClick={() => { act(() => A.storeItem(sel.uid)); setSelected(null); if (engineRef.current) engineRef.current.selected = null; }}><Icon name="box" />Guardar</button>}
              {!sel.locked && !sel.gift && selDef.price > 0 && <button className="btn sm danger" onClick={() => setConfirmSell(sel.uid)}><Icon name="trash" />Vender</button>}
            </>
          ) : <div className="small muted" style={{ alignSelf: 'center' }}>Toque num móvel para selecionar.</div>}
          <button className="btn sm" onClick={() => openPanel('inventory')}><Icon name="box" />Inventário</button>
          <button className="btn sm primary" onClick={() => setMode('play')}><Icon name="check" />Concluir</button>
        </div>
      )}
      {mode === 'place' && placing && (
        <div className="editbar">
          <div className="small" style={{ alignSelf: 'center' }}>Posicionando <b>{getItem(placing.defId)?.name}</b></div>
          <button className="btn sm" onClick={() => { engineRef.current?.rotatePlace(); setPlacing({ ...engineRef.current!.place! }); }}><Icon name="rotate" />Girar</button>
          <button className="btn sm" onClick={() => setMode(afterPlace.current)}>Cancelar</button>
        </div>
      )}

      {/* dock */}
      <nav className="dock" aria-label="Menu do jogo">
        <button className="save" onClick={() => { sfx.open(); setSaving(true); }}><Icon name="plus" size={18} />Economizei</button>
        <button className={panel === 'finance' ? 'on' : ''} onClick={() => openPanel('finance')}><Icon name="money" size={20} />Finanças</button>
        <button className={panel === 'shop' ? 'on' : ''} onClick={() => openPanel('shop')}><Icon name="shop" size={20} />Loja</button>
        <button className={mode === 'edit' ? 'on' : ''} onClick={() => { setPanel(null); setMode(mode === 'edit' ? 'play' : 'edit'); }}><Icon name="brush" size={20} />Decorar</button>
        <button className={panel === 'inventory' ? 'on' : ''} onClick={() => openPanel('inventory')}><Icon name="box" size={20} />Inventário</button>
        <button className={panel === 'missions' ? 'on' : ''} onClick={() => openPanel('missions')}><Icon name="target" size={20} />Missões{missionsReady > 0 && <span className="badge">{missionsReady}</span>}</button>
        <button className={panel === 'achievements' ? 'on' : ''} onClick={() => openPanel('achievements')}><Icon name="trophy" size={20} />Conquistas</button>
        <button className={panel === 'properties' ? 'on' : ''} onClick={() => openPanel('properties')}><Icon name="house" size={20} />Imóveis</button>
        <button className={panel === 'settings' ? 'on' : ''} onClick={() => openPanel('settings')}><Icon name="gear" size={20} />Ajustes</button>
      </nav>

      {panel === 'finance' && <FinancePanel save={save} tab={financeTab} setTab={setFinanceTab} onClose={() => setPanel(null)} />}
      {panel === 'shop' && <ShopPanel save={save} progress={progress} onClose={() => setPanel(null)} onPlace={(uid) => startPlacing(uid)} />}
      {panel === 'inventory' && <InventoryPanel save={save} onClose={() => setPanel(null)} onPlace={(uid) => startPlacing(uid, mode === 'edit' ? 'edit' : 'play')} />}
      {panel === 'missions' && <MissionsPanel save={save} onClose={() => setPanel(null)} />}
      {panel === 'achievements' && <AchievementsPanel save={save} progress={progress} onClose={() => setPanel(null)} />}
      {panel === 'properties' && <PropertiesPanel save={save} progress={progress} onClose={() => setPanel(null)} />}
      {panel === 'avatar' && <AvatarPanel save={save} progress={progress} onClose={() => setPanel(null)} />}
      {panel === 'settings' && <SettingsPanel save={save} onClose={() => setPanel(null)} onExit={onExit} />}

      {saving && <SavingDialog save={save} onClose={() => setSaving(false)} />}
      {confirmSell != null && (() => {
        const it = save.game.inventory.find((i) => i.uid === confirmSell); const d = it && getItem(it.defId);
        return d ? <Confirm title="Vender item?" text={<>Vender <b>{d.name}</b> por <Coins n={sellPrice(d)} /> moedas virtuais? (metade do preço)</>} yes="Vender" danger onClose={() => setConfirmSell(null)} onYes={() => { act(() => A.sellItem(confirmSell), 'Item vendido'); setSelected(null); sfx.coin(); }} /> : null;
      })()}
      {!save.profile.onboarded && <Onboarding save={save} onFinish={() => toast('Missão: registre sua primeira economia!', { icon: 'target', sub: 'Use o botão verde "Economizei".', ms: 5000 })} />}
      <Toasts />
    </div>
  );
}

export { ACH_BY_ID };
