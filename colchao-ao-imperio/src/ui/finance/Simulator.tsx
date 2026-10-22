import { useMemo, useState } from 'react';
import { addMonths, formatDateBR, todayISO } from '../../core/dates';
import { formatBRL, type Cents } from '../../core/money';
import { balancesAt, goalProgress } from '../../finance/ledger';
import { debtPayoff, goalTimeline, monthlyNeeded } from '../../finance/simulate';
import type { SaveData } from '../../state/types';
import { MoneyInput } from '../common';

const meses = (n: number) => (n === Infinity ? 'nunca' : n < 12 ? `${n} ${n === 1 ? 'mês' : 'meses'}` : `${Math.floor(n / 12)} ano(s) e ${n % 12} mês(es)`);

/** Simulações "e se": é matemática, não registra nada no seu dinheiro real. */
export function SimulatorView({ save }: { save: SaveData }) {
  const fin = save.finance;
  const bal = useMemo(() => balancesAt(fin), [fin]);
  // ---- meta ----
  const [goalId, setGoalId] = useState(fin.goals[0]?.id ?? '');
  const goal = fin.goals.find((g) => g.id === goalId);
  const [target, setTarget] = useState<Cents | null>(goal?.target ?? 300000);
  const [current, setCurrent] = useState<Cents | null>(goal ? goalProgress(fin, goal) : 0);
  const [monthly, setMonthly] = useState<Cents | null>(20000);
  const [rate, setRate] = useState('0,8');
  const [deadline, setDeadline] = useState(12);
  const r = Number(rate.replace(',', '.')) || 0;
  const g = goalTimeline(target ?? 0, current ?? 0, monthly ?? 0, r);
  const need = monthlyNeeded(target ?? 0, current ?? 0, deadline, r);
  // ---- dívida ----
  const debts = fin.accounts.filter((a) => a.type === 'debt' || a.type === 'credit_card');
  const [debtId, setDebtId] = useState(debts[0]?.id ?? '');
  const debt = debts.find((d) => d.id === debtId);
  const [dBal, setDBal] = useState<Cents | null>(debt ? Math.max(0, -(bal.get(debt.id) ?? 0)) : 500000);
  const [dRate, setDRate] = useState('3');
  const [pay, setPay] = useState<Cents | null>(debt?.debt?.installmentAmount ?? 30000);
  const [extra, setExtra] = useState<Cents | null>(10000);
  const dr = Number(dRate.replace(',', '.')) || 0;
  const base = debtPayoff(dBal ?? 0, dr, pay ?? 0);
  const plus = debtPayoff(dBal ?? 0, dr, pay ?? 0, extra ?? 0);

  return (
    <>
      <div className="hint" style={{ marginBottom: 10 }}>Simulações são só contas: nada aqui é registrado no seu dinheiro real.</div>
      <div className="card">
        <b>Quando chego na minha meta?</b>
        {fin.goals.length > 0 && (
          <select style={{ marginTop: 6 }} value={goalId} onChange={(e) => { const gg = fin.goals.find((x) => x.id === e.target.value); setGoalId(e.target.value); if (gg) { setTarget(gg.target); setCurrent(goalProgress(fin, gg)); } }}>
            {fin.goals.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        )}
        <div className="grid2">
          <div><label>Valor da meta</label><MoneyInput value={target} onChange={setTarget} /></div>
          <div><label>Já tenho</label><MoneyInput value={current} onChange={setCurrent} /></div>
          <div><label>Guardo por mês</label><MoneyInput value={monthly} onChange={setMonthly} /></div>
          <div><label htmlFor="sim-rate">Rendimento ao mês (%)</label><input id="sim-rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
        </div>
        <div className="card" style={{ marginTop: 10, background: 'var(--panel-3)' }}>
          {g.reachable
            ? <>Você chega em <b className="gold">{meses(g.months)}</b> (por volta de {formatDateBR(addMonths(todayISO(), g.months))}). Vai guardar {formatBRL(g.deposited)} e o rendimento soma {formatBRL(Math.max(0, g.interest))}.</>
            : <>Com esses valores você não chega na meta. Aumente o valor guardado por mês.</>}
        </div>
        <div className="row small" style={{ marginTop: 8, flexWrap: 'wrap' }}>
          Para chegar em
          <select value={deadline} onChange={(e) => setDeadline(Number(e.target.value))} style={{ width: 'auto', padding: '4px 6px' }}>
            {[3, 6, 12, 18, 24, 36, 60].map((m) => <option key={m} value={m}>{m} meses</option>)}
          </select>
          guarde <b className="gold">{formatBRL(need)}</b> por mês.
        </div>
      </div>
      <div className="card">
        <b>Quanto economizo antecipando a dívida?</b>
        {debts.length > 0 && (
          <select style={{ marginTop: 6 }} value={debtId} onChange={(e) => { const d = debts.find((x) => x.id === e.target.value); setDebtId(e.target.value); if (d) { setDBal(Math.max(0, -(bal.get(d.id) ?? 0))); if (d.debt) setPay(d.debt.installmentAmount); } }}>
            {debts.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        )}
        <div className="grid2">
          <div><label>Quanto devo hoje</label><MoneyInput value={dBal} onChange={setDBal} /></div>
          <div><label htmlFor="sim-drate">Juros ao mês (%)</label><input id="sim-drate" inputMode="decimal" value={dRate} onChange={(e) => setDRate(e.target.value)} /></div>
          <div><label>Parcela atual</label><MoneyInput value={pay} onChange={setPay} /></div>
          <div><label>Extra por mês</label><MoneyInput value={extra} onChange={setExtra} /></div>
        </div>
        <table className="tbl" style={{ marginTop: 10 }}>
          <thead><tr><th /><th className="r">Prazo</th><th className="r">Juros pagos</th></tr></thead>
          <tbody>
            <tr><td>Só a parcela</td><td className="r">{base.payable ? meses(base.months) : 'nunca quita'}</td><td className="r">{base.payable ? formatBRL(base.interest) : '—'}</td></tr>
            <tr><td>Parcela + extra</td><td className="r">{plus.payable ? meses(plus.months) : 'nunca quita'}</td><td className="r">{plus.payable ? formatBRL(plus.interest) : '—'}</td></tr>
          </tbody>
        </table>
        {base.payable && plus.payable && base.interest > plus.interest && (
          <div className="small pos" style={{ marginTop: 6 }}>Pagando o extra você economiza <b>{formatBRL(base.interest - plus.interest)}</b> em juros e termina {base.months - plus.months} mês(es) antes.</div>
        )}
        {!base.payable && <div className="small neg" style={{ marginTop: 6 }}>A parcela não cobre nem os juros do mês: a dívida só cresce. Vale renegociar.</div>}
      </div>
    </>
  );
}
