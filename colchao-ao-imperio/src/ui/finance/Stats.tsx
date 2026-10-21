import { useMemo, useState } from 'react';
import { monthKey, monthLabel, monthName, todayISO } from '../../core/dates';
import { formatBRL, type Cents } from '../../core/money';
import { lastMonths, monthSummary, netWorthSeries, projection } from '../../finance/ledger';
import { computeProgress } from '../../game/progress';
import type { SaveData } from '../../state/types';
import { Seg } from '../common';

/* Gráficos SVG simples. Paleta validada (CVD) no fundo escuro: receitas #3987e5, despesas #d95926. */

interface Tip { x: number; y: number; html: React.ReactNode }

function niceMax(v: number) {
  if (v <= 0) return 10000;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
const short = (c: Cents) => formatBRL(c, { compact: true }).replace('R$ ', '');

function Bars({ data, onTip }: { data: { label: string; a: number; b: number; full: string }[]; onTip: (t: Tip | null) => void }) {
  const W = 640, H = 220, L = 46, B = 24, T = 10;
  const max = niceMax(Math.max(10000, ...data.flatMap((d) => [d.a, d.b])));
  const bw = (W - L - 10) / data.length;
  const y = (v: number) => H - B - (v / max) * (H - B - T);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Receitas e despesas por mês">
      {ticks.map((v) => <g key={v}><line x1={L} x2={W - 6} y1={y(v)} y2={y(v)} stroke="#3a3249" strokeWidth={1} /><text x={L - 6} y={y(v) + 3} textAnchor="end">{short(v)}</text></g>)}
      {data.map((d, i) => {
        const x = L + i * bw;
        const w = Math.max(3, Math.min(18, bw / 2 - 4));
        const bar = (v: number, dx: number, c: string) => {
          const h = Math.max(0, H - B - y(v));
          if (h <= 0) return null;
          const r = Math.min(4, w / 2, h);
          const x0 = x + dx, yt = y(v), yb = H - B;
          return <path d={`M${x0},${yb} V${yt + r} Q${x0},${yt} ${x0 + r},${yt} H${x0 + w - r} Q${x0 + w},${yt} ${x0 + w},${yt + r} V${yb} Z`} fill={c} />;
        };
        return (
          <g key={d.label}>
            {bar(d.a, bw / 2 - w - 1, 'var(--income)')}
            {bar(d.b, bw / 2 + 1, 'var(--expense)')}
            <text x={x + bw / 2} y={H - 8} textAnchor="middle">{d.label}</text>
            <rect x={x} y={T} width={bw} height={H - B - T} fill="transparent"
              onPointerMove={(e) => onTip({ x: e.clientX, y: e.clientY, html: <><b>{d.full}</b><br />Receitas + economias: {formatBRL(d.a)}<br />Despesas: {formatBRL(d.b)}<br />Resultado: {formatBRL(d.a - d.b, { sign: true })}</> })}
              onPointerLeave={() => onTip(null)} />
          </g>
        );
      })}
      <line x1={L} x2={W - 6} y1={H - B} y2={H - B} stroke="#6b5f80" strokeWidth={1} />
    </svg>
  );
}

function Line({ data, label, color = 'var(--income)', dashedFrom, onTip }: { data: { label: string; v: number; full: string }[]; label: string; color?: string; dashedFrom?: number; onTip: (t: Tip | null) => void }) {
  const W = 640, H = 200, L = 52, B = 24, T = 12;
  const minV = Math.min(0, ...data.map((d) => d.v));
  const maxV = niceMax(Math.max(minV < 0 ? 0 : 10000, ...data.map((d) => d.v)));
  const span = maxV - minV || 1;
  const x = (i: number) => L + (i * (W - L - 16)) / Math.max(1, data.length - 1);
  const y = (v: number) => H - B - ((v - minV) / span) * (H - B - T);
  const [hover, setHover] = useState<number | null>(null);
  const pts = data.map((d, i) => `${x(i)},${y(d.v)}`);
  const split = dashedFrom ?? data.length;
  const ticks = [0, 0.5, 1].map((f) => minV + f * span);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={label}
      onPointerMove={(e) => {
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * W;
        const i = Math.max(0, Math.min(data.length - 1, Math.round(((px - L) / (W - L - 16)) * (data.length - 1))));
        setHover(i);
        onTip({ x: e.clientX, y: e.clientY, html: <><b>{data[i].full}</b><br />{label}: {formatBRL(data[i].v)}</> });
      }}
      onPointerLeave={() => { setHover(null); onTip(null); }}>
      {ticks.map((v) => <g key={v}><line x1={L} x2={W - 8} y1={y(v)} y2={y(v)} stroke="#3a3249" /><text x={L - 6} y={y(v) + 3} textAnchor="end">{short(v)}</text></g>)}
      {minV < 0 && <line x1={L} x2={W - 8} y1={y(0)} y2={y(0)} stroke="#6b5f80" />}
      <polyline points={pts.slice(0, split).join(' ')} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {split < data.length && <polyline points={pts.slice(split - 1).join(' ')} fill="none" stroke={color} strokeWidth={2} strokeDasharray="5 4" />}
      {data.map((d, i) => (i % Math.ceil(data.length / 8) === 0 || i === data.length - 1) && <text key={i} x={x(i)} y={H - 8} textAnchor="middle">{d.label}</text>)}
      {hover != null && <><line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#9187a3" strokeDasharray="2 3" /><circle cx={x(hover)} cy={y(data[hover].v)} r={4.5} fill={color} stroke="#221d2e" strokeWidth={2} /></>}
      <text x={x(data.length - 1)} y={y(data[data.length - 1].v) - 8} textAnchor="end" style={{ fill: 'var(--ink-2)' }}>{formatBRL(data[data.length - 1].v, { compact: true })}</text>
    </svg>
  );
}

export function StatsView({ save }: { save: SaveData }) {
  const [range, setRange] = useState<'6' | '12'>('6');
  const [tip, setTip] = useState<Tip | null>(null);
  const [table, setTable] = useState(false);
  const fin = save.finance;
  const months = useMemo(() => lastMonths(Number(range)), [range]);
  const sums = useMemo(() => months.map((m) => monthSummary(fin, m)), [fin, months]);
  const nw = useMemo(() => netWorthSeries(fin, lastMonths(12)), [fin]);
  const proj = useMemo(() => projection(fin, 6), [fin]);
  const cur = monthSummary(fin, monthKey(todayISO()));
  const cats = [...cur.byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const catMax = Math.max(1, ...cats.map((c) => c[1]));
  const catName = (id: string) => fin.categories.find((c) => c.id === id)?.name ?? 'Sem categoria';
  const prog = computeProgress(save);
  const totalIn = sums.reduce((s, m) => s + m.income + m.saved, 0), totalOut = sums.reduce((s, m) => s + m.expense, 0);

  return (
    <>
      <div className="row between" style={{ marginBottom: 8 }}>
        <Seg value={range} onChange={setRange} options={[{ id: '6', label: '6 meses' }, { id: '12', label: '12 meses' }]} />
        <button className="btn sm" onClick={() => setTable(!table)}>{table ? 'Ver gráficos' : 'Ver tabela'}</button>
      </div>
      {table ? (
        <table className="tbl">
          <thead><tr><th>Mês</th><th className="r">Receitas</th><th className="r">Economias</th><th className="r">Despesas</th><th className="r">Resultado</th></tr></thead>
          <tbody>{sums.map((s) => <tr key={s.month}><td>{monthName(s.month)}</td><td className="r">{formatBRL(s.income)}</td><td className="r">{formatBRL(s.saved)}</td><td className="r">{formatBRL(s.expense)}</td><td className={`r ${s.result >= 0 ? 'pos' : 'neg'}`}>{formatBRL(s.result)}</td></tr>)}</tbody>
        </table>
      ) : (
        <>
          <div className="card">
            <b>Receitas x despesas</b>
            <div className="legend"><span><i style={{ background: 'var(--income)' }} />Receitas + economias ({formatBRL(totalIn)})</span><span><i style={{ background: 'var(--expense)' }} />Despesas ({formatBRL(totalOut)})</span></div>
            <Bars data={sums.map((s) => ({ label: monthLabel(s.month), a: s.income + s.saved, b: s.expense, full: monthName(s.month) }))} onTip={setTip} />
          </div>
          <div className="card">
            <b>Patrimônio líquido (12 meses)</b>
            <Line data={nw.map((p) => ({ label: monthLabel(p.month), v: p.netWorth, full: monthName(p.month) }))} label="Patrimônio" onTip={setTip} />
          </div>
          <div className="card">
            <b>Projeção do saldo disponível</b> <span className="chip">simulação</span>
            <div className="tiny muted" style={{ margin: '4px 0' }}>Saldo atual das contas + recorrências − parcelas − faturas previstas. Não inclui gastos variáveis.</div>
            <Line data={proj.map((p) => ({ label: monthLabel(p.month), v: p.liquid, full: monthName(p.month) }))} label="Saldo projetado" dashedFrom={1} onTip={setTip} />
          </div>
        </>
      )}
      <div className="card">
        <b>Despesas por categoria · {monthName(monthKey(todayISO()))}</b>
        {cats.length ? cats.map(([id, v]) => (
          <div key={id} style={{ marginTop: 6 }}>
            <div className="row between small"><span>{catName(id)}</span><span className="amount">{formatBRL(v)} · {Math.round((v / Math.max(1, cur.expense)) * 100)}%</span></div>
            <div style={{ height: 8, background: '#15121d', borderRadius: 2 }}><div style={{ width: `${(v / catMax) * 100}%`, height: '100%', background: 'var(--expense)', borderRadius: '0 4px 4px 0' }} /></div>
          </div>
        )) : <div className="small muted">Sem despesas neste mês.</div>}
      </div>
      <div className="card">
        <b>Números da jornada</b>
        <table className="tbl" style={{ marginTop: 6 }}>
          <tbody>
            <tr><td>Maior ganho de patrimônio desde o início</td><td className="r">{formatBRL(prog.metrics.peakGain)}</td></tr>
            <tr><td>Dívidas antigas reduzidas</td><td className="r">{formatBRL(prog.metrics.debtReduction)}</td></tr>
            <tr><td>Dias com registros</td><td className="r">{prog.metrics.activityDays}</td></tr>
            <tr><td>Melhor sequência</td><td className="r">{prog.metrics.bestStreak} dias</td></tr>
            <tr><td>Meses no azul</td><td className="r">{prog.metrics.positiveMonths}</td></tr>
            <tr><td>Lançamentos</td><td className="r">{prog.metrics.txCount}</td></tr>
          </tbody>
        </table>
      </div>
      {tip && <div className="tooltip" style={{ left: Math.min(tip.x + 12, window.innerWidth - 230), top: tip.y + 12 }}>{tip.html}</div>}
    </>
  );
}
