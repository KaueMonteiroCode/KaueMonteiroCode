import { useEffect, useRef, useState, type ReactNode } from 'react';
import { centsToInput, formatCoins, parseBRL, type Cents } from '../core/money';
import { getItem } from '../game/catalog';
import { drawItemThumb, drawStyleThumb } from '../engine/thumbs';
import { getStyle } from '../game/styles';
import { todayISO } from '../core/dates';
import { saveFile } from '../core/download';
import { HELP, HelpBody } from './help';
import { sfx } from '../audio/sfx';

/* ---------------- ícones pixel (SVG gerado de bitmaps) ---------------- */

const ICONS: Record<string, { map: string[]; colors: Record<string, string> }> = {
  coin: { map: ['..XXXX..', '.XYYYYX.', 'XYYXXYYX', 'XYXYYYYX', 'XYXYYYYX', 'XYYXXYYX', '.XYYYYX.', '..XXXX..'], colors: { X: '#8a5a00', Y: '#ffd34d' } },
  money: { map: ['XXXXXXXX', 'XGGGGGGX', 'XGWGGWGX', 'XGGWWGGX', 'XGGWWGGX', 'XGWGGWGX', 'XGGGGGGX', 'XXXXXXXX'], colors: { X: '#14532d', G: '#4ade80', W: '#dcfce7' } },
  shop: { map: ['RRWWRRWW', 'RRWWRRWW', 'XXXXXXXX', '.X....X.', '.X.BB.X.', '.X.BB.X.', '.X.BB.X.', '.XXXXXX.'], colors: { R: '#ef4444', W: '#fff', X: '#a3a3a3', B: '#60a5fa' } },
  box: { map: ['.XXXXXX.', 'XBBBBBBX', 'XXXXXXXX', 'XBBTTBBX', 'XBBBBBBX', 'XBBBBBBX', 'XBBBBBBX', 'XXXXXXXX'], colors: { X: '#5a3d20', B: '#c49a66', T: '#f3e2c0' } },
  brush: { map: ['.....XX.', '....XYX.', '...XYX..', '..XYX...', '.WWX....', 'WWW.....', 'WW......', 'W.......'], colors: { X: '#6b4226', Y: '#d2a66b', W: '#f472b6' } },
  star: { map: ['...XX...', '...YY...', 'XXYYYYXX', '.XYYYYX.', '..YYYY..', '.YY..YY.', '.Y....Y.', '........'], colors: { X: '#b45309', Y: '#ffd34d' } },
  trophy: { map: ['XYYYYYYX', 'XYYYYYYX', '.YYYYYY.', '..YYYY..', '...YY...', '...YY...', '..XXXX..', '.XXXXXX.'], colors: { X: '#8a5a00', Y: '#ffd34d' } },
  house: { map: ['...XX...', '..XRRX..', '.XRRRRX.', 'XRRRRRRX', '.WWWWWW.', '.WBWWDW.', '.WWWWDW.', '.WWWWDW.'], colors: { X: '#7f1d1d', R: '#ef4444', W: '#f5f5f4', B: '#60a5fa', D: '#92400e' } },
  person: { map: ['..XXXX..', '..SSSS..', '..SKSK..', '..SSSS..', '.BBBBBB.', 'SBBBBBBS', '..PPPP..', '..P..P..'], colors: { X: '#4a2c17', S: '#f1c27d', K: '#111', B: '#60a5fa', P: '#2b3a67' } },
  gear: { map: ['..X..X..', '.XXXXXX.', 'XXX..XXX', '.X....X.', '.X....X.', 'XXX..XXX', '.XXXXXX.', '..X..X..'], colors: { X: '#9ca3af' } },
  plus: { map: ['...XX...', '...XX...', '...XX...', 'XXXXXXXX', 'XXXXXXXX', '...XX...', '...XX...', '...XX...'], colors: { X: '#08210f' } },
  chart: { map: ['X.......', 'X.....G.', 'X....GG.', 'X..B.GG.', 'X.BB.GG.', 'XRBB.GG.', 'XRBB.GG.', 'XXXXXXXX'], colors: { X: '#9ca3af', R: '#d95926', B: '#3987e5', G: '#4ade80' } },
  target: { map: ['..RRRR..', '.RWWWWR.', 'RWRRRRWR', 'RWRWWRWR', 'RWRWWRWR', 'RWRRRRWR', '.RWWWWR.', '..RRRR..'], colors: { R: '#ef4444', W: '#fff' } },
  scroll: { map: ['.XXXXXX.', 'XYYYYYYX', '.YLLLLY.', '.YYYYYY.', '.YLLLY..', '.YYYYYY.', 'XYYYYYYX', '.XXXXXX.'], colors: { X: '#92400e', Y: '#fde68a', L: '#a16207' } },
  calendar: { map: ['.X....X.', 'RRRRRRRR', 'RRRRRRRR', 'WWWWWWWW', 'WKWKWKWW', 'WWWWWWWW', 'WKWRWKWW', 'WWWWWWWW'], colors: { X: '#555', R: '#ef4444', W: '#f5f5f4', K: '#555' } },
  close: { map: ['XX....XX', 'XXX..XXX', '.XXXXXX.', '..XXXX..', '..XXXX..', '.XXXXXX.', 'XXX..XXX', 'XX....XX'], colors: { X: '#c9c0d6' } },
  rotate: { map: ['..XXXX..', '.X....X.', 'X......X', 'X....XXX', 'X.....X.', 'X.......', '.X....X.', '..XXXX..'], colors: { X: '#e5e7eb' } },
  trash: { map: ['..XXXX..', 'XXXXXXXX', '.X....X.', '.XX.X.X.', '.XX.X.X.', '.XX.X.X.', '.X....X.', '.XXXXXX.'], colors: { X: '#fca5a5' } },
  check: { map: ['........', '.......X', '......XX', 'X....XX.', 'XX..XX..', '.XXXX...', '..XX....', '........'], colors: { X: '#4ade80' } },
  sound: { map: ['...X....', '..XX..X.', 'XXXX.X.X', 'XXXX.X.X', 'XXXX.X.X', 'XXXX.X.X', '..XX..X.', '...X....'], colors: { X: '#e5e7eb' } },
  fit: { map: ['XXX..XXX', 'X......X', 'X......X', '........', '........', 'X......X', 'X......X', 'XXX..XXX'], colors: { X: '#e5e7eb' } },
  zin: { map: ['..XXX...', '.X...X..', 'X..X..X.', 'X.XXX.X.', 'X..X..X.', '.X...X..', '..XXXXX.', '......XX'], colors: { X: '#e5e7eb' } },
  zout: { map: ['..XXX...', '.X...X..', 'X.....X.', 'X.XXX.X.', 'X.....X.', '.X...X..', '..XXXXX.', '......XX'], colors: { X: '#e5e7eb' } },
  card: { map: ['XXXXXXXX', 'XBBBBBBX', 'XXXXXXXX', 'XBBBBBBX', 'XBYYBBBX', 'XBBBBBBX', 'XXXXXXXX', '........'], colors: { X: '#1e3a8a', B: '#3b82f6', Y: '#fde047' } },
  pig: { map: ['........', '.PPPPPP.', 'PPPKPPPP', 'PPPPPPPN', 'PPPPPPPN', '.PPPPPP.', '.P.P.P..', '........'], colors: { P: '#f29bb8', K: '#111', N: '#d97895' } },
  hammer: { map: ['XXXXX...', 'XXXXXW..', '...XWW..', '...WW...', '..WW....', '.WW.....', 'WW......', 'W.......'], colors: { X: '#9ca3af', W: '#a16207' } },
  camera: { map: ['........', '..XX....', 'XXXXXXXX', 'XWWXXWWX', 'XWXLLXWX', 'XWXLLXWX', 'XWWXXWWX', 'XXXXXXXX'], colors: { X: '#9ca3af', W: '#4b5563', L: '#60a5fa' } },
  save: { map: ['XXXXXXX.', 'XWWWWWXX', 'XWWWWWXX', 'XXXXXXXX', 'XBBBBBBX', 'XBWWWWBX', 'XBWWWWBX', 'XXXXXXXX'], colors: { X: '#1e3a8a', W: '#e5e7eb', B: '#3b82f6' } },
};

export function Icon({ name, size = 16 }: { name: keyof typeof ICONS | string; size?: number }) {
  const ic = ICONS[name] ?? ICONS.star;
  const rects: ReactNode[] = [];
  ic.map.forEach((row, y) => row.split('').forEach((ch, x) => {
    const c = ic.colors[ch];
    if (c) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={c} />);
  }));
  return <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden="true" style={{ flexShrink: 0 }}>{rects}</svg>;
}

export function Coins({ n, className = '' }: { n: number; className?: string }) {
  return <span className={`nowrap ${className}`}><Icon name="coin" size={14} /> <span className="pix" style={{ fontSize: 11 }}>{n < 0 ? '-' : ''}{formatCoins(Math.abs(n))}</span></span>;
}

/* ---------------- toasts ---------------- */

export interface ToastMsg { id: number; text: ReactNode; sub?: ReactNode; kind?: 'ok' | 'err' | 'ach' | 'info'; icon?: string; ms?: number; action?: { label: string; run: () => void } }
type ToastL = (t: ToastMsg[]) => void;
let toasts: ToastMsg[] = [];
let tid = 1;
const tl = new Set<ToastL>();
export function toast(text: ReactNode, opts: Omit<ToastMsg, 'id' | 'text'> = {}) {
  const t: ToastMsg = { id: tid++, text, ...opts };
  toasts = [...toasts, t].slice(-5);
  tl.forEach((l) => l(toasts));
  if (t.kind === 'err') sfx.error();
  setTimeout(() => { toasts = toasts.filter((x) => x.id !== t.id); tl.forEach((l) => l(toasts)); }, t.ms ?? (t.kind === 'ach' ? 4500 : 2800));
}
export function errToast(e: unknown) { toast(e instanceof Error ? e.message : String(e), { kind: 'err', icon: 'close' }); }
export function Toasts() {
  const [list, setList] = useState<ToastMsg[]>(toasts);
  useEffect(() => { tl.add(setList); return () => { tl.delete(setList); }; }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast ${t.kind ?? ''}`}>
          {t.icon && <Icon name={t.icon} size={t.kind === 'ach' ? 28 : 18} />}
          <div className="grow">
            <div style={{ fontWeight: 700, fontSize: t.kind === 'ach' ? 13 : 13 }}>{t.text}</div>
            {t.sub && <div className="small muted">{t.sub}</div>}
          </div>
          {t.action && <button className="btn sm gold" onClick={() => { t.action!.run(); toasts = toasts.filter((x) => x.id !== t.id); tl.forEach((l) => l(toasts)); }}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  );
}

/* ---------------- modal / drawer ---------------- */

const modalStack: number[] = [];
let modalSeq = 0;
export function Modal({ title, children, onClose, wide }: { title: ReactNode; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const id = ++modalSeq;
    modalStack.push(id);
    // Esc fecha só a janela do topo (janelas empilhadas não fecham todas de uma vez)
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && modalStack[modalStack.length - 1] === id) { e.stopPropagation(); close.current(); } };
    window.addEventListener('keydown', k);
    return () => { window.removeEventListener('keydown', k); const i = modalStack.indexOf(id); if (i >= 0) modalStack.splice(i, 1); };
  }, []);
  return (
    <div className="modal-back" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="row between" style={{ marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn ghost icon" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Drawer({ title, icon, children, onClose, tabs, tab, setTab, wide, help }: {
  title: ReactNode; icon?: string; children: ReactNode; onClose: () => void; wide?: boolean;
  tabs?: { id: string; label: string }[]; tab?: string; setTab?: (t: string) => void; help?: string;
}) {
  const [showHelp, setShowHelp] = useState(false);
  return (
    <aside className={`drawer ${wide ? 'wide' : ''}`}>
      <div className="drawer-head">
        {icon && <Icon name={icon} size={20} />}
        <h2>{title}</h2>
        {help && <button className="btn ghost icon help-btn" onClick={() => setShowHelp(true)} aria-label="Ajuda" title="Ajuda">?</button>}
        {help && showHelp && <Modal title={HELP[help]?.title ?? 'Ajuda'} onClose={() => setShowHelp(false)}><HelpBody id={help} />{help === 'finance' || help === 'shop' ? <HelpBody id="coins" /> : null}</Modal>}
        <button className="btn ghost icon" onClick={onClose} aria-label="Fechar painel"><Icon name="close" /></button>
      </div>
      {tabs && (
        <div className="tabs">
          {tabs.map((t) => <button key={t.id} className={t.id === tab ? 'on' : ''} onClick={() => { sfx.click(); setTab?.(t.id); }}>{t.label}</button>)}
        </div>
      )}
      <div className="drawer-body">{children}</div>
    </aside>
  );
}

/* ---------------- entrada monetária ---------------- */

export function MoneyInput({ value, onChange, autoFocus, placeholder = '0,00', allowNegative, id }: { value: Cents | null; onChange: (v: Cents | null) => void; autoFocus?: boolean; placeholder?: string; allowNegative?: boolean; id?: string }) {
  const [text, setText] = useState(value != null ? centsToInput(value) : '');
  const [bad, setBad] = useState(false);
  const emitted = useRef<Cents | null>(value);
  // valor alterado de fora (ex.: sugestão automática) atualiza o texto
  useEffect(() => {
    if (value === emitted.current) return;
    emitted.current = value;
    setBad(false);
    setText(value != null ? centsToInput(value) : '');
  }, [value]);
  const emit = (v: Cents | null) => { emitted.current = v; onChange(v); };
  return (
    <div className="row" style={{ gap: 0 }}>
      <span style={{ padding: '8px 10px', background: '#0e0b14', borderRadius: '4px 0 0 4px', border: '2px solid var(--line)', borderRight: 'none', color: 'var(--ink-3)' }}>R$</span>
      <input
        id={id}
        inputMode="decimal" autoFocus={autoFocus} placeholder={placeholder} value={text}
        style={{ borderRadius: '0 4px 4px 0', borderColor: bad ? 'var(--red)' : undefined, fontVariantNumeric: 'tabular-nums' }}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          if (!t.trim()) { setBad(false); emit(null); return; }
          const v = parseBRL(t);
          if (v == null || (!allowNegative && v < 0)) { setBad(true); emit(null); } else { setBad(false); emit(v); }
        }}
      />
    </div>
  );
}

/* ---------------- miniaturas ---------------- */

export function ItemThumb({ defId, size = 96, animate = false, className = 'thumb' }: { defId: string; size?: number; animate?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current; const def = getItem(defId);
    if (!c || !def) return;
    let raf = 0; const t0 = performance.now();
    const draw = () => { drawItemThumb(c, def, (performance.now() - t0) / 1000 + 0.5); if (animate) raf = requestAnimationFrame(draw); };
    // desenha só quando a miniatura entra na tela (lojas com centenas de itens)
    if (animate || typeof IntersectionObserver === 'undefined') { draw(); return () => cancelAnimationFrame(raf); }
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { draw(); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(c);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [defId, animate]);
  return <canvas ref={ref} width={size} height={size} className={className} />;
}

export function StyleThumb({ styleId, size = 96 }: { styleId: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const c = ref.current; const st = getStyle(styleId); if (c && st) drawStyleThumb(c, st, 0.5); }, [styleId]);
  return <canvas ref={ref} width={size} height={size} className="thumb" />;
}

export function Progress({ value, max, kind = '' }: { value: number; max: number; kind?: '' | 'gold' | 'red' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return <div className={`progress ${kind}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${pct}%` }} /></div>;
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return <div className="seg">{options.map((o) => <button key={o.id} type="button" className={o.id === value ? 'on' : ''} onClick={() => onChange(o.id)}>{o.label}</button>)}</div>;
}

export function Confirm({ title, text, onYes, onClose, yes = 'Confirmar', danger }: { title: string; text: ReactNode; onYes: () => void; onClose: () => void; yes?: string; danger?: boolean }) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="small" style={{ lineHeight: 1.6 }}>{text}</div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className={`btn ${danger ? 'danger' : 'primary'}`} onClick={() => { onYes(); onClose(); }}>{yes}</button>
      </div>
    </Modal>
  );
}

/** Executa uma ação e mostra erro amigável */
export function act<T>(fn: () => T, ok?: string): T | undefined {
  try {
    const r = fn();
    if (ok) toast(ok, { kind: 'ok', icon: 'check' });
    return r;
  } catch (e) {
    errToast(e);
    return undefined;
  }
}

/** Exportação que funciona mesmo onde downloads são bloqueados: baixar OU copiar o texto. */
export function ExportBox({ title, filename, content, mime, onClose, note }: { title: string; filename: string; content: string; mime: string; onClose: () => void; note?: ReactNode }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const [dl, setDl] = useState('');
  const download = async () => {
    const r = await saveFile(filename, content, mime);
    setDl(r === 'saved' ? 'Arquivo enviado para download.' : r === 'declined' ? 'Download cancelado.' : 'Não foi possível baixar aqui; use Copiar texto.');
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(content); setCopied(true); }
    catch { ref.current?.select(); document.execCommand?.('copy'); setCopied(true); }
  };
  return (
    <Modal title={title} onClose={onClose} wide>
      {note && <div className="small muted" style={{ marginBottom: 8, lineHeight: 1.5 }}>{note}</div>}
      <textarea ref={ref} readOnly value={content} rows={8} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }} onFocus={(e) => e.currentTarget.select()} />
      <div className="small muted" style={{ marginTop: 6 }}>Se o download não começar (comum no celular), toque em Copiar e cole num bloco de notas, e-mail ou mensagem para você mesmo.</div>
      <div className="row wrap" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
        <button className="btn" onClick={download}>Baixar {filename.split('.').pop()?.toUpperCase()}</button>
        <button className="btn primary" onClick={copy}>{copied ? 'Copiado!' : 'Copiar texto'}</button>
      </div>
      {dl && <div className="small gold" style={{ marginTop: 6, textAlign: 'right' }}>{dl}</div>}
    </Modal>
  );
}

/** Data de hoje que se atualiza sozinha na virada do dia (com o jogo aberto). */
export function useToday(): string {
  const [d, setD] = useState(todayISO());
  useEffect(() => {
    const id = setInterval(() => { const t = todayISO(); setD((old) => (old === t ? old : t)); }, 30000);
    return () => clearInterval(id);
  }, []);
  return d;
}
