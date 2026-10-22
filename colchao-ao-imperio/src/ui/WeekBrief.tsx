import { addDays, formatDateBR } from '../core/dates';
import { formatBRL } from '../core/money';
import { calendarEvents } from '../finance/ledger';
import type { SaveData } from '../state/types';
import { Modal } from './common';

/** Contas vencidas e as que vencem nos próximos 7 dias. */
export function weekItems(save: SaveData, today: string) {
  const ev = calendarEvents(save.finance, addDays(today, -60), addDays(today, 7)).filter((e) => !e.done && (e.amount < 0 || e.kind === 'pending'));
  return { overdue: ev.filter((e) => e.date < today), soon: ev.filter((e) => e.date >= today) };
}

export function WeekBrief({ save, today, onClose, onOpenCalendar }: { save: SaveData; today: string; onClose: () => void; onOpenCalendar: () => void }) {
  const { overdue, soon } = weekItems(save, today);
  const total = [...overdue, ...soon].reduce((a, e) => a + Math.max(0, -e.amount), 0);
  const line = (e: (typeof soon)[number]) => (
    <div key={e.ref} className="row small" style={{ marginTop: 4 }}>
      <span className="muted nowrap">{formatDateBR(e.date)}</span><span className="grow ellipsis">{e.label}</span><span className="amount">{formatBRL(Math.abs(e.amount))}</span>
    </div>
  );
  return (
    <Modal title="Resumo da semana" onClose={onClose}>
      {overdue.length > 0 && <div className="card" style={{ boxShadow: '0 0 0 2px var(--red)' }}><b className="neg">Vencidas sem confirmação ({overdue.length})</b>{overdue.map(line)}</div>}
      {soon.length > 0 && <div className="card"><b>Vencem nos próximos 7 dias ({soon.length})</b>{soon.map(line)}</div>}
      <div className="small muted" style={{ marginTop: 8 }}>Total: {formatBRL(total)}. Confirme no calendário só o que já foi pago de verdade.</div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn ghost" onClick={onClose}>Depois</button>
        <button className="btn primary" onClick={onOpenCalendar}>Abrir calendário</button>
      </div>
    </Modal>
  );
}
