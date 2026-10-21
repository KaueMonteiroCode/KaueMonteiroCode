import { useMemo, useState } from 'react';
import { addMonthKey, daysInMonth, formatDateBR, fromISO, monthKey, monthName, todayISO } from '../../core/dates';
import { formatBRL, type Cents } from '../../core/money';
import { calendarEvents, type CalendarEvent } from '../../finance/ledger';
import * as A from '../../state/actions';
import type { SaveData } from '../../state/types';
import { isLiability } from '../../state/types';
import { act, Modal, MoneyInput } from '../common';

export function CalendarView({ save }: { save: SaveData }) {
  const [mk, setMk] = useState(monthKey(todayISO()));
  const [day, setDay] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<CalendarEvent | null>(null);
  const from = `${mk}-01`, to = `${mk}-${String(daysInMonth(mk)).padStart(2, '0')}`;
  const events = useMemo(() => calendarEvents(save.finance, from, to), [save, from, to]);
  const txByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of save.finance.transactions) if (!t.deleted && t.date >= from && t.date <= to && t.status === 'confirmed') m.set(t.date, (m.get(t.date) ?? 0) + 1);
    return m;
  }, [save, from, to]);
  const firstDow = fromISO(from).getDay();
  const cells: (string | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth(mk) }, (_, i) => `${mk}-${String(i + 1).padStart(2, '0')}`)];
  const today = todayISO();
  const outTotal = events.filter((e) => e.amount < 0).reduce((s, e) => s - e.amount, 0);
  const inTotal = events.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const dayEvents = day ? events.filter((e) => e.date === day) : [];

  return (
    <>
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="btn sm" onClick={() => setMk(addMonthKey(mk, -1))}>◀</button>
        <b>{monthName(mk)}</b>
        <button className="btn sm" onClick={() => setMk(addMonthKey(mk, 1))}>▶</button>
      </div>
      <div className="small" style={{ marginBottom: 8 }}>Previsto: entra <b className="pos">{formatBRL(inTotal)}</b> · sai <b className="neg">{formatBRL(outTotal)}</b></div>
      <div className="cal">
        {['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map((d) => <div key={d} className="h">{d}</div>)}
        {cells.map((d, i) => d ? (
          <div key={d} className={`d ${d === today ? 'today' : ''}`} onClick={() => setDay(d)}>
            <div className="row between"><b>{Number(d.slice(8))}</b>{txByDay.get(d) ? <span className="tiny muted">{txByDay.get(d)}✓</span> : null}</div>
            {events.filter((e) => e.date === d).slice(0, 3).map((e) => (
              <div key={e.ref} className="ev" style={{ background: e.done ? '#24412f' : e.date < today ? '#5a2323' : e.amount > 0 ? '#1f3a5f' : '#4a3420', textDecoration: e.done ? 'line-through' : undefined }}>{e.label}</div>
            ))}
          </div>
        ) : <div key={`x${i}`} />)}
      </div>
      <div className="tiny muted" style={{ marginTop: 6 }}>Verde: confirmado · vermelho: vencido sem confirmação · laranja: a vencer · azul: entrada prevista.</div>

      {day && (
        <Modal title={`Dia ${formatDateBR(day)}`} onClose={() => setDay(null)}>
          {dayEvents.length ? dayEvents.map((e) => (
            <div key={e.ref} className="li" style={{ marginTop: 6 }}>
              <div className="grow"><b className="small">{e.label}</b><div className="tiny muted">{e.kind === 'recurring' ? 'Recorrência' : e.kind === 'debt' ? 'Parcela de dívida' : e.kind === 'invoice' ? 'Fatura de cartão' : 'Pendente'}{e.done ? ' · confirmado' : ''}</div></div>
              <span className={`amount ${e.amount > 0 ? 'pos' : 'neg'}`}>{formatBRL(Math.abs(e.amount))}</span>
              {!e.done && (e.kind === 'recurring' || e.kind === 'debt') && <button className="btn sm primary" onClick={() => setConfirm(e)}>Confirmar</button>}
              {!e.done && e.kind === 'pending' && e.date <= today && <button className="btn sm primary" onClick={() => act(() => A.confirmPending(e.ref), 'Confirmado')}>Confirmar</button>}
            </div>
          )) : <div className="small muted">Nada previsto neste dia.</div>}
          <div className="small muted" style={{ marginTop: 10 }}>{txByDay.get(day) ?? 0} lançamento(s) confirmado(s) neste dia.</div>
        </Modal>
      )}
      {confirm && <ConfirmEvent save={save} ev={confirm} onClose={() => { setConfirm(null); }} />}
    </>
  );
}

function ConfirmEvent({ save, ev, onClose }: { save: SaveData; ev: CalendarEvent; onClose: () => void }) {
  const rule = ev.ruleId ? save.finance.recurring.find((r) => r.id === ev.ruleId) : undefined;
  const assets = save.finance.accounts.filter((a) => !a.archived && !isLiability(a.type));
  const [amount, setAmount] = useState<Cents | null>(Math.abs(ev.amount));
  const [date, setDate] = useState(ev.date > todayISO() ? todayISO() : ev.date);
  const [acc, setAcc] = useState(rule?.accountId ?? assets[0]?.id ?? '');
  return (
    <Modal title="Confirmar que aconteceu" onClose={onClose}>
      <div className="hint warn">Confirme somente o que de fato foi {ev.amount > 0 ? 'recebido' : 'pago'}. O valor pode ser ajustado se veio diferente.</div>
      <div className="small" style={{ marginTop: 8 }}><b>{ev.label}</b> · previsto para {formatDateBR(ev.date)}</div>
      <label>Valor real</label><MoneyInput value={amount} onChange={setAmount} />
      <div className="grid2">
        <div><label>Data real</label><input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label>Conta</label><select value={acc} onChange={(e) => setAcc(e.target.value)}>{(ev.kind === 'debt' ? assets : save.finance.accounts.filter((a) => !a.archived)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={!amount || !acc} onClick={() => {
          const ok = act(() => {
            if (ev.kind === 'recurring' && ev.ruleId) A.confirmOccurrence(ev.ruleId, ev.date, { amount: amount!, accountId: acc, date });
            if (ev.kind === 'debt' && ev.debt) A.payDebtInstallment(ev.debt.debtAccountId, ev.debt.number, acc, date, amount!);
            return true;
          }, 'Confirmado!');
          if (ok) onClose();
        }}>Confirmar</button>
      </div>
    </Modal>
  );
}
