import { useMemo, useState } from 'react';
import { addDays, formatDateBR, monthKey, monthName, todayISO, addMonthKey } from '../../core/dates';
import { formatBRL, type Cents } from '../../core/money';
import {
  accountName, averageMonthlyExpense, balancesAt, calendarEvents, cardInvoiceStatus, debtInstallments, goalProgress, monthSummary, totals,
} from '../../finance/ledger';
import * as A from '../../state/actions';
import type { Account, AccountType, SaveData, Transaction } from '../../state/types';
import { isLiability } from '../../state/types';
import { act, Confirm, Drawer, Icon, Modal, MoneyInput, Progress, toast } from '../common';
import { TxForm } from './TxForm';
import { CalendarView } from './Calendar';
import { StatsView } from './Stats';
import { DataView } from './Data';
import { PlanningView } from './Planning';
import { SimulatorView } from './Simulator';

const TABS = [
  { id: 'resumo', label: 'Resumo' }, { id: 'lancamentos', label: 'Lançamentos' }, { id: 'contas', label: 'Contas' },
  { id: 'cartoes', label: 'Cartões' }, { id: 'dividas', label: 'Dívidas' }, { id: 'planejamento', label: 'Recorrentes, metas e orçamento' },
  { id: 'calendario', label: 'Calendário' }, { id: 'estatisticas', label: 'Estatísticas' }, { id: 'simulador', label: 'Simulador' }, { id: 'dados', label: 'Importar, exportar e histórico' },
];

export const ACC_TYPES: { id: AccountType; label: string }[] = [
  { id: 'checking', label: 'Conta corrente' }, { id: 'cash', label: 'Dinheiro / carteira' }, { id: 'savings', label: 'Poupança' },
  { id: 'reserve', label: 'Reserva de emergência / cofrinho' }, { id: 'investment', label: 'Investimentos' },
  { id: 'credit_card', label: 'Cartão de crédito' }, { id: 'debt', label: 'Dívida / empréstimo / financiamento' },
];
export const accTypeLabel = (t: AccountType) => ACC_TYPES.find((x) => x.id === t)?.label ?? t;

export function FinancePanel({ save, tab, setTab, onClose }: { save: SaveData; tab: string; setTab: (t: string) => void; onClose: () => void }) {
  const go = (t: string) => { setTab(t); if (['calendario', 'estatisticas', 'metas'].includes(t)) A.visit(t); if (t === 'planejamento') A.visit('metas'); };
  return (
    <Drawer help="finance" title="Finanças reais" icon="money" onClose={onClose} wide tabs={TABS} tab={tab} setTab={go}>
      <div className="hint real" style={{ marginBottom: 10 }}>Aqui é <b>dinheiro de verdade</b>, em reais. Nada aqui é gasto pelo jogo. Valores são guardados em centavos, sem arredondamentos.</div>
      {tab === 'resumo' && <Summary save={save} go={go} />}
      {tab === 'lancamentos' && <TransactionsView save={save} />}
      {tab === 'contas' && <AccountsView save={save} filter="assets" />}
      {tab === 'cartoes' && <CardsView save={save} />}
      {tab === 'dividas' && <DebtsView save={save} />}
      {tab === 'planejamento' && <PlanningView save={save} />}
      {tab === 'calendario' && <CalendarView save={save} />}
      {tab === 'estatisticas' && <StatsView save={save} />}
      {tab === 'simulador' && <SimulatorView save={save} />}
      {tab === 'dados' && <DataView save={save} />}
    </Drawer>
  );
}

/* ================= RESUMO ================= */

function Summary({ save, go }: { save: SaveData; go: (t: string) => void }) {
  const fin = save.finance;
  const t = useMemo(() => totals(fin), [fin]);
  const mk = monthKey(todayISO());
  const ms = useMemo(() => monthSummary(fin, mk), [fin, mk]);
  const upcoming = useMemo(() => calendarEvents(fin, addDays(todayISO(), -15), addDays(todayISO(), 15)).filter((e) => !e.done && e.amount < 0), [fin]);
  const overdue = upcoming.filter((e) => e.date < todayISO());
  const next = upcoming.filter((e) => e.date >= todayISO()).slice(0, 5);
  const avg = averageMonthlyExpense(fin);
  const reserve = fin.accounts.filter((a) => a.type === 'reserve').reduce((s, a) => s + (balancesAt(fin).get(a.id) ?? 0), 0);
  const [form, setForm] = useState<null | Partial<A.TxInput>>(null);

  return (
    <>
      <div className="grid3">
        <div className="card"><div className="tiny muted">Patrimônio líquido</div><div className={`amount ${t.netWorth >= 0 ? 'pos' : 'neg'}`} style={{ fontSize: 17 }}>{formatBRL(t.netWorth)}</div></div>
        <div className="card"><div className="tiny muted">Ativos</div><div className="amount" style={{ fontSize: 15 }}>{formatBRL(t.assets)}</div></div>
        <div className="card"><div className="tiny muted">Dívidas</div><div className="amount neg" style={{ fontSize: 15 }}>{formatBRL(t.liabilities)}</div></div>
      </div>
      <div className="row wrap" style={{ margin: '10px 0' }}>
        <button className="btn sm danger" onClick={() => setForm({ kind: 'expense' })}>- Despesa</button>
        <button className="btn sm primary" onClick={() => setForm({ kind: 'income' })}>+ Receita</button>
        <button className="btn sm" onClick={() => setForm({ kind: 'transfer' })}>⇄ Transferência</button>
        <button className="btn sm" onClick={() => go('contas')}>Contas</button>
      </div>
      <div className="card">
        <div className="row between"><b>{monthName(mk)}</b><span className="tiny muted">{ms.count} lançamentos</span></div>
        <div className="grid3" style={{ marginTop: 8 }}>
          <div><div className="tiny muted">Receitas</div><div className="amount">{formatBRL(ms.income)}</div></div>
          <div><div className="tiny muted">Economias declaradas</div><div className="amount">{formatBRL(ms.saved)}</div></div>
          <div><div className="tiny muted">Despesas</div><div className="amount">{formatBRL(ms.expense)}</div></div>
        </div>
        <div className="hr" />
        <div className="row between"><span>Resultado do mês</span><b className={ms.result >= 0 ? 'pos' : 'neg'}>{formatBRL(ms.result, { sign: true })}</b></div>
      </div>
      <MonthInsights save={save} mk={mk} />
      {overdue.length > 0 && (
        <div className="card" style={{ boxShadow: '0 0 0 2px var(--red)' }}>
          <b className="neg">Vencidos e não confirmados ({overdue.length})</b>
          {overdue.map((e) => <div key={e.ref} className="row small" style={{ marginTop: 4 }}><span className="muted">{formatDateBR(e.date)}</span><span className="grow ellipsis">{e.label}</span><span className="amount">{formatBRL(-e.amount)}</span></div>)}
          <button className="btn sm" style={{ marginTop: 6 }} onClick={() => go('calendario')}>Abrir calendário</button>
        </div>
      )}
      <div className="card">
        <b>Próximos pagamentos</b>
        {next.length ? next.map((e) => <div key={e.ref} className="row small" style={{ marginTop: 4 }}><span className="muted">{formatDateBR(e.date)}</span><span className="grow ellipsis">{e.label}</span><span className="amount">{formatBRL(-e.amount)}</span></div>) : <div className="small muted">Nada nos próximos 15 dias.</div>}
      </div>
      <div className="card">
        <b>Reserva de emergência</b>
        {avg > 0 ? (
          <>
            <div className="small muted">Ideal: 6 meses de despesas ({formatBRL(avg * 6)}). Você tem {formatBRL(reserve)} ({(reserve / avg).toFixed(1).replace('.', ',')} meses).</div>
            <div style={{ marginTop: 6 }}><Progress value={reserve} max={avg * 6} kind="gold" /></div>
          </>
        ) : <div className="small muted">Registre despesas por um mês para calcular a reserva ideal. Crie uma conta do tipo "Reserva" para acompanhar.</div>}
      </div>
      <div className="card">
        <b>Saldos por conta</b>
        {fin.accounts.filter((a) => !a.archived).map((a) => <AccountLine key={a.id} save={save} a={a} />)}
        {!fin.accounts.length && <div className="small muted">Nenhuma conta ainda. <button className="btn sm" onClick={() => go('contas')}>Cadastrar</button></div>}
      </div>
      {form && <TxForm save={save} preset={form} onClose={() => setForm(null)} />}
    </>
  );
}

/** Raio-X do mês: taxa de poupança, ritmo de gastos e o que mudou em relação ao mês anterior. */
function MonthInsights({ save, mk }: { save: SaveData; mk: string }) {
  const fin = save.finance;
  const cur = monthSummary(fin, mk);
  const prev = monthSummary(fin, addMonthKey(mk, -1));
  if (!cur.count && !prev.count) return null;
  const inflow = cur.income + cur.saved;
  const rate = inflow > 0 ? Math.round((cur.result / inflow) * 100) : null;
  const day = Number(todayISO().slice(8, 10));
  const dim = new Date(Number(mk.slice(0, 4)), Number(mk.slice(5, 7)), 0).getDate();
  const pace = day > 0 ? Math.round((cur.expense / day) * dim) : cur.expense;
  const catName = (id: string) => fin.categories.find((c) => c.id === id)?.name ?? 'Sem categoria';
  const ids = new Set([...cur.byCategory.keys(), ...prev.byCategory.keys()]);
  const changes = [...ids].map((id) => ({ id, d: (cur.byCategory.get(id) ?? 0) - (prev.byCategory.get(id) ?? 0) })).filter((c) => c.d !== 0).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 3);
  return (
    <div className="card">
      <b>Raio-X do mês</b>
      <div className="grid3" style={{ marginTop: 8 }}>
        <div><div className="tiny muted">Taxa de poupança</div><div className={`amount ${rate != null && rate >= 0 ? 'pos' : 'neg'}`}>{rate == null ? '—' : `${rate}%`}</div><div className="tiny muted">do que entrou ficou</div></div>
        <div><div className="tiny muted">Ritmo de gastos</div><div className="amount">{formatBRL(pace)}</div><div className="tiny muted">se seguir assim até dia {dim}</div></div>
        <div><div className="tiny muted">Despesas x mês passado</div><div className={`amount ${cur.expense <= prev.expense ? 'pos' : 'neg'}`}>{formatBRL(cur.expense - prev.expense, { sign: true })}</div><div className="tiny muted">{prev.expense ? `mês passado: ${formatBRL(prev.expense)}` : 'sem dados do mês passado'}</div></div>
      </div>
      {changes.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="tiny muted">Maiores mudanças por categoria</div>
          {changes.map((c) => <div key={c.id} className="row small between" style={{ marginTop: 3 }}><span>{catName(c.id)}</span><span className={c.d > 0 ? 'neg' : 'pos'}>{c.d > 0 ? '▲' : '▼'} {formatBRL(Math.abs(c.d))}</span></div>)}
        </div>
      )}
    </div>
  );
}

function AccountLine({ save, a }: { save: SaveData; a: Account }) {
  const v = balancesAt(save.finance).get(a.id) ?? 0;
  return (
    <div className="row small" style={{ marginTop: 6 }}>
      <span className="dot" style={{ width: 10, height: 10, borderRadius: 3, background: a.color }} />
      <span className="grow ellipsis">{a.name} <span className="tiny muted">· {accTypeLabel(a.type)}</span></span>
      <span className={`amount ${v < 0 ? 'neg' : ''}`}>{isLiability(a.type) ? `deve ${formatBRL(-v)}` : formatBRL(v)}</span>
    </div>
  );
}

/* ================= LANÇAMENTOS ================= */

function TransactionsView({ save }: { save: SaveData }) {
  const fin = save.finance;
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [q, setQ] = useState('');
  const [acc, setAcc] = useState('');
  const [kind, setKind] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [edit, setEdit] = useState<Transaction | null>(null);
  const [form, setForm] = useState<Partial<A.TxInput> | null>(null);
  const [del, setDel] = useState<Transaction | null>(null);
  const [hist, setHist] = useState<Transaction | null>(null);
  const cat = new Map(fin.categories.map((c) => [c.id, c]));
  const list = fin.transactions
    .filter((t) => (month === 'todos' || monthKey(t.date) === month) && (showDeleted ? t.deleted : !t.deleted))
    .filter((t) => !acc || t.accountId === acc || t.toAccountId === acc)
    .filter((t) => !kind || t.kind === kind)
    .filter((t) => !q || t.description.toLowerCase().includes(q.toLowerCase()) || (t.categoryId && cat.get(t.categoryId)?.name.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));

  return (
    <>
      <div className="row wrap" style={{ marginBottom: 8 }}>
        <button className="btn sm" onClick={() => setMonth(addMonthKey(month === 'todos' ? monthKey(todayISO()) : month, -1))}>◀</button>
        <span className="small" style={{ minWidth: 130, textAlign: 'center' }}>{month === 'todos' ? 'Todos os meses' : monthName(month)}</span>
        <button className="btn sm" onClick={() => setMonth(addMonthKey(month === 'todos' ? monthKey(todayISO()) : month, 1))}>▶</button>
        <button className={`btn sm ${month === 'todos' ? 'gold' : ''}`} onClick={() => setMonth(month === 'todos' ? monthKey(todayISO()) : 'todos')}>Todos</button>
        <div className="grow" />
        <button className="btn sm primary" onClick={() => setForm({ kind: 'expense' })}>+ Novo</button>
      </div>
      <div className="row wrap" style={{ marginBottom: 8 }}>
        <input placeholder="Buscar descrição/categoria" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 2, minWidth: 140 }} />
        <select value={acc} onChange={(e) => setAcc(e.target.value)} style={{ flex: 1, minWidth: 120 }}><option value="">Todas as contas</option>{fin.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ flex: 1, minWidth: 110 }}><option value="">Todos os tipos</option><option value="income">Receitas</option><option value="expense">Despesas</option><option value="transfer">Transferências</option><option value="adjustment">Ajustes</option></select>
      </div>
      <label className="row small" style={{ marginTop: 0 }}><input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} style={{ width: 'auto' }} /> Mostrar lixeira (excluídos)</label>
      <div className="list">
        {list.map((t) => {
          const c = t.categoryId ? cat.get(t.categoryId) : undefined;
          const sign = t.kind === 'income' ? '+' : t.kind === 'expense' ? '-' : t.kind === 'adjustment' ? (t.amount >= 0 ? '+' : '-') : '';
          return (
            <div key={t.id} className="li" style={{ opacity: t.status === 'pending' ? 0.7 : 1 }}>
              <span className="dot" style={{ background: c?.color ?? (t.kind === 'transfer' ? '#9ca3af' : '#666') }} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="ellipsis" style={{ fontWeight: 600 }}>{t.description || c?.name || (t.kind === 'transfer' ? 'Transferência' : 'Lançamento')}</div>
                <div className="tiny muted ellipsis">
                  {formatDateBR(t.date)} · {t.kind === 'transfer' ? `${accountName(fin, t.accountId)} → ${accountName(fin, t.toAccountId)}` : accountName(fin, t.accountId)}
                  {c ? ` · ${c.name}` : ''}{t.saving ? ' · economia' : ''}{t.installments ? ` · ${t.installments.count}x` : ''}{t.status === 'pending' ? ' · PENDENTE' : ''}{t.history?.length ? ` · editado ${t.history.length}x` : ''}
                </div>
              </div>
              <span className={`amount ${t.kind === 'income' || (t.kind === 'adjustment' && t.amount > 0) ? 'pos' : t.kind === 'transfer' ? '' : 'neg'}`}>{sign}{formatBRL(Math.abs(t.amount))}</span>
              {!t.deleted ? (
                <div className="row" style={{ gap: 2 }}>
                  {t.status === 'pending' && t.date <= todayISO() && <button className="btn sm primary" title="Confirmar" onClick={() => act(() => A.confirmPending(t.id), 'Confirmado')}>✓</button>}
                  <button className="btn sm" title="Corrigir" onClick={() => setEdit(t)}>✎</button>
                  {(t.kind === 'income' || t.kind === 'expense' || t.kind === 'transfer') && !t.debtInstallment && !t.recurringId && (
                    <button className="btn sm" title="Repetir hoje" aria-label="Repetir hoje" onClick={() => setForm({ kind: t.kind, amount: t.amount, accountId: t.accountId, toAccountId: t.toAccountId, categoryId: t.categoryId, description: t.description, saving: t.saving, date: todayISO() })}>⧉</button>
                  )}
                  <button className="btn sm" title="Histórico" onClick={() => setHist(t)}>⟲</button>
                  <button className="btn sm danger" title="Excluir" onClick={() => setDel(t)}>✕</button>
                </div>
              ) : <button className="btn sm" onClick={() => act(() => A.restoreTransaction(t.id), 'Restaurado')}>Restaurar</button>}
            </div>
          );
        })}
        {!list.length && <div className="small muted">Nenhum lançamento aqui.</div>}
      </div>
      {(form || edit) && <TxForm save={save} tx={edit ?? undefined} preset={form ?? undefined} onClose={() => { setForm(null); setEdit(null); }} />}
      {del && <Confirm title="Excluir lançamento?" text={<>O lançamento vai para a lixeira (pode ser restaurado) e o histórico fica registrado. Se ele tinha gerado moedas, o valor será <b>recalculado</b>.</>} yes="Excluir" danger onClose={() => setDel(null)} onYes={() => { const id = del.id; const ok = act(() => { A.deleteTransaction(id); return true; }); if (ok) toast('Lançamento excluído', { kind: 'ok', icon: 'trash', ms: 6000, action: { label: 'Desfazer', run: () => act(() => A.restoreTransaction(id), 'Exclusão desfeita') } }); }} />}
      {hist && (
        <Modal title="Histórico de alterações" onClose={() => setHist(null)}>
          <div className="small">Criado em {new Date(hist.createdAt).toLocaleString('pt-BR')}</div>
          {(hist.history ?? []).map((h, i) => (
            <div key={i} className="card small" style={{ marginTop: 6 }}>
              <b>{h.action === 'edit' ? 'Editado' : h.action === 'delete' ? 'Excluído' : 'Restaurado'}</b> em {new Date(h.at).toLocaleString('pt-BR')}
              <div className="muted">Antes: {h.before.kind} · {formatBRL(h.before.amount)} · {formatDateBR(h.before.date)} · {h.before.description || '—'}</div>
            </div>
          ))}
          {!hist.history?.length && <div className="small muted" style={{ marginTop: 6 }}>Nunca foi alterado.</div>}
        </Modal>
      )}
    </>
  );
}

/* ================= CONTAS ================= */

export function AccountForm({ save, account, presetType, onClose }: { save: SaveData; account?: Account; presetType?: AccountType; onClose: () => void }) {
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState<AccountType>(account?.type ?? presetType ?? 'checking');
  const [amt, setAmt] = useState<Cents | null>(account ? Math.abs(account.initialBalance) : null);
  const [opened, setOpened] = useState(account?.openedAt ?? todayISO());
  const [limit, setLimit] = useState<Cents | null>(account?.creditLimit ?? null);
  const [closing, setClosing] = useState(account?.closingDay ?? 5);
  const [due, setDue] = useState(account?.dueDay ?? 12);
  const [hasPlan, setHasPlan] = useState(!!account?.debt);
  const [instAmt, setInstAmt] = useState<Cents | null>(account?.debt?.installmentAmount ?? null);
  const [instN, setInstN] = useState(account?.debt?.installmentsTotal ?? 12);
  const [firstDue, setFirstDue] = useState(account?.debt?.firstDueDate ?? addDays(todayISO(), 30));
  const [creditor, setCreditor] = useState(account?.debt?.creditor ?? '');
  const liab = isLiability(type);
  const submit = () => {
    const input: A.AccountInput = {
      name, type, initialAmount: amt ?? 0, openedAt: opened,
      creditLimit: type === 'credit_card' ? limit ?? undefined : undefined, closingDay: type === 'credit_card' ? closing : undefined, dueDay: type === 'credit_card' ? due : undefined,
      debt: type === 'debt' && hasPlan && instAmt ? { installmentAmount: instAmt, installmentsTotal: instN, firstDueDate: firstDue, creditor } : undefined,
    };
    const ok = act(() => { if (account) A.updateAccount(account.id, input); else A.addAccount(input); return true; }, account ? 'Conta atualizada' : 'Conta criada');
    if (ok) onClose();
  };
  void save;
  return (
    <Modal title={account ? 'Editar conta' : 'Nova conta'} onClose={onClose}>
      <div className="hint">Só um nome e o saldo. Nunca informe número de conta, agência ou senha.</div>
      <label>Nome</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank, Carteira, Cofrinho" autoFocus />
      <label>Tipo</label>
      <select value={type} disabled={!!account} onChange={(e) => setType(e.target.value as AccountType)}>{ACC_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select>
      <div className="grid2">
        <div><label>{liab ? (type === 'credit_card' ? 'Fatura em aberto hoje' : 'Quanto você deve hoje') : 'Saldo inicial'}</label><MoneyInput value={amt} onChange={setAmt} allowNegative={!liab} /></div>
        <div><label>Saldo válido a partir de</label><input type="date" value={opened} onChange={(e) => setOpened(e.target.value)} /></div>
      </div>
      {type === 'credit_card' && (
        <div className="grid3">
          <div><label>Limite</label><MoneyInput value={limit} onChange={setLimit} /></div>
          <div><label>Fecha dia</label><input type="number" min={1} max={31} value={closing} onChange={(e) => setClosing(Number(e.target.value))} /></div>
          <div><label>Vence dia</label><input type="number" min={1} max={31} value={due} onChange={(e) => setDue(Number(e.target.value))} /></div>
        </div>
      )}
      {type === 'debt' && (
        <>
          <label className="row" style={{ color: 'var(--ink)' }}><input type="checkbox" checked={hasPlan} onChange={(e) => setHasPlan(e.target.checked)} style={{ width: 'auto' }} /> Tem parcelas fixas</label>
          {hasPlan && (
            <div className="grid2">
              <div><label>Valor da parcela</label><MoneyInput value={instAmt} onChange={setInstAmt} /></div>
              <div><label>Total de parcelas do contrato</label><input type="number" min={1} max={480} value={instN} onChange={(e) => setInstN(Number(e.target.value))} /></div>
              <div><label>Vencimento da 1ª parcela</label><input type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} /></div>
              <div><label>Credor (opcional)</label><input value={creditor} onChange={(e) => setCreditor(e.target.value)} /></div>
            </div>
          )}
          <div className="tiny muted" style={{ marginTop: 6 }}>Recebeu um empréstimo agora? Crie a dívida com saldo 0 e registre uma transferência <b>da dívida para sua conta</b>: o patrimônio não muda (não é enriquecimento).</div>
        </>
      )}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={!name.trim()} onClick={submit}>Salvar</button>
      </div>
    </Modal>
  );
}

function AccountsView({ save, filter }: { save: SaveData; filter: 'assets' }) {
  const [form, setForm] = useState<{ account?: Account } | null>(null);
  const [del, setDel] = useState<Account | null>(null);
  const bal = balancesAt(save.finance);
  const list = save.finance.accounts.filter((a) => filter === 'assets' ? !isLiability(a.type) : true);
  return (
    <>
      <div className="row between" style={{ marginBottom: 8 }}><b>Contas e carteiras</b><button className="btn sm primary" onClick={() => setForm({})}>+ Conta</button></div>
      <div className="list">
        {list.map((a) => (
          <div key={a.id} className="li" style={{ opacity: a.archived ? 0.5 : 1 }}>
            <span className="dot" style={{ background: a.color }} />
            <div className="grow"><b>{a.name}</b><div className="tiny muted">{accTypeLabel(a.type)} · saldo inicial {formatBRL(a.initialBalance)} em {formatDateBR(a.openedAt)}{a.archived ? ' · arquivada' : ''}</div></div>
            <span className="amount">{formatBRL(bal.get(a.id) ?? 0)}</span>
            <button className="btn sm" onClick={() => setForm({ account: a })}>✎</button>
            <button className="btn sm" title={a.archived ? 'Desarquivar' : 'Arquivar'} onClick={() => act(() => A.updateAccount(a.id, { archived: !a.archived }))}>{a.archived ? '↺' : '⌂'}</button>
            <button className="btn sm danger" onClick={() => setDel(a)}>✕</button>
          </div>
        ))}
        {!list.length && <div className="small muted">Nenhuma conta. Comece com "Carteira" ou sua conta principal.</div>}
      </div>
      <div className="tiny muted" style={{ marginTop: 10 }}>Cartões e dívidas ficam nas abas próprias.</div>
      {form && <AccountForm save={save} account={form.account} onClose={() => setForm(null)} />}
      {del && <Confirm title="Excluir conta?" text="Só é possível excluir contas sem lançamentos. Se houver, arquive." yes="Excluir" danger onClose={() => setDel(null)} onYes={() => act(() => A.deleteAccount(del.id), 'Conta excluída')} />}
    </>
  );
}

/* ================= CARTÕES ================= */

function CardsView({ save }: { save: SaveData }) {
  const fin = save.finance;
  const cards = fin.accounts.filter((a) => a.type === 'credit_card');
  const bal = balancesAt(fin);
  const [form, setForm] = useState<{ account?: Account } | null>(null);
  const [buy, setBuy] = useState<string | null>(null);
  const [pay, setPay] = useState<{ card: Account; month: string; amount: Cents } | null>(null);
  const cur = monthKey(todayISO());
  return (
    <>
      <div className="row between" style={{ marginBottom: 8 }}><b>Cartões de crédito</b><button className="btn sm primary" onClick={() => setForm({})}>+ Cartão</button></div>
      {cards.map((c) => {
        const inv = cardInvoiceStatus(fin, c);
        const owed = -(bal.get(c.id) ?? 0);
        // faturas atrasadas não pagas + mês atual + próximos 5
        const late = [...inv.entries()].filter(([m, st]) => m < cur && !st.paid).map(([m]) => m);
        const months = [...late, ...[0, 1, 2, 3, 4, 5].map((i) => addMonthKey(cur, i))];
        return (
          <div key={c.id} className="card">
            <div className="row between"><b>{c.name}</b><span className="small">fecha dia {c.closingDay ?? '—'} · vence dia {c.dueDay ?? '—'}</span></div>
            <div className="row between small" style={{ marginTop: 6 }}><span>Total devido no cartão</span><b className="neg">{formatBRL(owed)}</b></div>
            {c.creditLimit ? <div style={{ marginTop: 4 }}><Progress value={owed} max={c.creditLimit} kind={owed / c.creditLimit > 0.8 ? 'red' : 'gold'} /><div className="tiny muted">Limite usado: {formatBRL(owed)} de {formatBRL(c.creditLimit)}</div></div> : null}
            <table className="tbl" style={{ marginTop: 8 }}>
              <thead><tr><th>Fatura</th><th className="r">Compras</th><th /></tr></thead>
              <tbody>
                {months.map((m) => {
                  const st = inv.get(m);
                  return (
                    <tr key={m}>
                      <td>{monthName(m)}{m < cur && st && !st.paid ? <span className="neg tiny"> · atrasada</span> : null}</td>
                      <td className="r">{formatBRL(st?.amount ?? 0)}</td>
                      <td className="r">{!st ? null : st.paid ? <span className="chip pos">paga</span> : <button className="btn sm" onClick={() => setPay({ card: c, month: m, amount: Math.max(1, Math.min(st.remaining, owed > 0 ? owed : st.remaining)) })}>Pagar {st.remaining !== st.amount ? formatBRL(st.remaining) : ''}</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="tiny muted">As faturas mostram as compras de cada mês (com parcelas). O pagamento é uma transferência da sua conta para o cartão.</div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn sm danger" onClick={() => setBuy(c.id)}>+ Compra no cartão</button>
              <button className="btn sm" onClick={() => setForm({ account: c })}>Editar</button>
            </div>
          </div>
        );
      })}
      {!cards.length && <div className="small muted">Nenhum cartão cadastrado.</div>}
      {form && <AccountForm save={save} account={form.account} presetType="credit_card" onClose={() => setForm(null)} />}
      {buy && <TxForm save={save} preset={{ kind: 'expense', accountId: buy }} onClose={() => setBuy(null)} />}
      {pay && <PayModal save={save} title={`Pagar fatura ${pay.card.name} · ${monthName(pay.month)}`} amount={pay.amount} onClose={() => setPay(null)} onPay={(from, amt, date) => A.payCardInvoice(pay.card.id, from, amt, date, pay.month)} />}
    </>
  );
}

function PayModal({ save, title, amount, onClose, onPay, note }: { save: SaveData; title: string; amount: Cents; onClose: () => void; onPay: (from: string, amount: Cents, date: string) => void; note?: string }) {
  const assets = save.finance.accounts.filter((a) => !a.archived && !isLiability(a.type));
  const [from, setFrom] = useState(assets[0]?.id ?? '');
  const [amt, setAmt] = useState<Cents | null>(amount);
  const [date, setDate] = useState(todayISO());
  const bal = balancesAt(save.finance);
  return (
    <Modal title={title} onClose={onClose}>
      <div className="hint warn">Confirme apenas se o pagamento <b>realmente aconteceu</b>. Nada é marcado como pago automaticamente.</div>
      {note && <div className="small muted" style={{ marginTop: 6 }}>{note}</div>}
      <label>Valor pago</label><MoneyInput value={amt} onChange={setAmt} />
      <div className="grid2">
        <div><label>Pago com</label><select value={from} onChange={(e) => setFrom(e.target.value)}>{assets.map((a) => <option key={a.id} value={a.id}>{a.name} ({formatBRL(bal.get(a.id) ?? 0)})</option>)}</select></div>
        <div><label>Data do pagamento</label><input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      {!assets.length && <div className="small neg" style={{ marginTop: 6 }}>Cadastre uma conta para pagar.</div>}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={!amt || !from} onClick={() => { const ok = act(() => { onPay(from, amt!, date); return true; }, 'Pagamento registrado'); if (ok) onClose(); }}>Confirmar pagamento</button>
      </div>
    </Modal>
  );
}

/* ================= DÍVIDAS ================= */

function DebtsView({ save }: { save: SaveData }) {
  const fin = save.finance;
  const debts = fin.accounts.filter((a) => a.type === 'debt');
  const bal = balancesAt(fin);
  const [form, setForm] = useState<{ account?: Account } | null>(null);
  const [pay, setPay] = useState<{ acc: Account; n: number; amount: Cents; due: string } | null>(null);
  const [extra, setExtra] = useState<Account | null>(null);
  const [interest, setInterest] = useState<Account | null>(null);
  return (
    <>
      <div className="row between" style={{ marginBottom: 8 }}><b>Dívidas e empréstimos</b><button className="btn sm primary" onClick={() => setForm({})}>+ Dívida</button></div>
      {debts.map((d) => {
        const owed = -(bal.get(d.id) ?? 0);
        const initial = -d.initialBalance;
        const inst = debtInstallments(fin, d);
        const paid = inst.filter((i) => i.paid).length;
        const nextOpen = inst.filter((i) => !i.paid).slice(0, 4);
        return (
          <div key={d.id} className="card">
            <div className="row between"><b>{d.name}</b>{owed <= 0 ? <span className="chip pos">QUITADA</span> : <b className="neg">{formatBRL(owed)}</b>}</div>
            {d.debt?.creditor && <div className="tiny muted">Credor: {d.debt.creditor}</div>}
            {initial > 0 && <div style={{ marginTop: 6 }}><Progress value={initial - Math.max(0, owed)} max={initial} /><div className="tiny muted">Pago {formatBRL(Math.max(0, initial - owed))} de {formatBRL(initial)}</div></div>}
            {d.debt && (
              <>
                <div className="small" style={{ marginTop: 6 }}>Parcelas: {paid}/{d.debt.installmentsTotal} pagas · {formatBRL(d.debt.installmentAmount)} cada</div>
                <div className="list" style={{ marginTop: 6 }}>
                  {nextOpen.map((i) => (
                    <div key={i.number} className="row small">
                      <span className="grow">Parcela {i.number} · vence {formatDateBR(i.dueDate)} {i.dueDate < todayISO() && <span className="neg">(atrasada)</span>}</span>
                      {i.paidAmount > 0 && <span className="tiny muted">pago {formatBRL(i.paidAmount)} · falta {formatBRL(i.remaining)}</span>}
                      <button className="btn sm primary" onClick={() => setPay({ acc: d, n: i.number, amount: i.remaining, due: i.dueDate })}>{i.dueDate > todayISO() ? 'Antecipar' : 'Pagar'}</button>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="row wrap" style={{ marginTop: 8 }}>
              <button className="btn sm" onClick={() => setExtra(d)}>Pagamento avulso</button>
              <button className="btn sm" onClick={() => setInterest(d)}>Lançar juros</button>
              <button className="btn sm" onClick={() => setForm({ account: d })}>Editar</button>
            </div>
          </div>
        );
      })}
      {!debts.length && <div className="small muted">Nenhuma dívida cadastrada. Que maravilha (ou cadastre para acompanhar).</div>}
      <div className="hint" style={{ marginTop: 10 }}>Pagar dívida reduz ativos e passivos juntos: o patrimônio não muda, mas você ganha moedas por reduzir dívidas que já existiam. Empréstimos novos não contam como enriquecimento.</div>
      {form && <AccountForm save={save} account={form.account} presetType="debt" onClose={() => setForm(null)} />}
      {pay && <PayModal save={save} title={`Pagar parcela ${pay.n} · ${pay.acc.name}`} amount={pay.amount} note={`${pay.due > todayISO() ? 'Pagamento antes do vencimento conta como parcela antecipada. ' : ''}Pagando menos que o valor, a parcela fica parcial até completar.`} onClose={() => setPay(null)} onPay={(from, amt, date) => { A.payDebtInstallment(pay.acc.id, pay.n, from, date, amt); toast(amt >= pay.amount ? 'Parcela paga!' : 'Pagamento parcial registrado', { kind: 'ok', icon: 'check' }); }} />}
      {extra && <PayModal save={save} title={`Pagamento avulso · ${extra.name}`} amount={Math.max(0, -(bal.get(extra.id) ?? 0))} onClose={() => setExtra(null)} onPay={(from, amt, date) => A.addTransaction({ kind: 'transfer', amount: amt, accountId: from, toAccountId: extra.id, date, description: `Pagamento ${extra.name}` })} />}
      {interest && <TxForm save={save} preset={{ kind: 'expense', accountId: interest.id, categoryId: 'cat-juros', description: `Juros ${interest.name}` }} onClose={() => setInterest(null)} />}
    </>
  );
}

export { Icon, goalProgress };
