import { useState } from 'react';
import { addDays, formatDateBR, monthKey, todayISO } from '../../core/dates';
import { formatBRL, type Cents } from '../../core/money';
import { averageMonthlyExpense, goalProgress, monthSummary } from '../../finance/ledger';
import * as A from '../../state/actions';
import type { Goal, RecurringRule, SaveData } from '../../state/types';
import { isLiability } from '../../state/types';
import { act, Confirm, Modal, MoneyInput, Progress, Seg } from '../common';

export function PlanningView({ save }: { save: SaveData }) {
  const [sub, setSub] = useState<'recorrentes' | 'metas' | 'orcamento' | 'categorias'>('recorrentes');
  return (
    <>
      <Seg value={sub} onChange={setSub} options={[{ id: 'recorrentes', label: 'Recorrentes' }, { id: 'metas', label: 'Metas' }, { id: 'orcamento', label: 'Orçamento' }, { id: 'categorias', label: 'Categorias' }]} />
      <div style={{ marginTop: 10 }}>
        {sub === 'recorrentes' && <RecurringView save={save} />}
        {sub === 'metas' && <GoalsView save={save} />}
        {sub === 'orcamento' && <BudgetView save={save} />}
        {sub === 'categorias' && <CategoriesView save={save} />}
      </div>
    </>
  );
}

/* ---------- recorrentes / assinaturas ---------- */

function RecurringForm({ save, rule, onClose }: { save: SaveData; rule?: RecurringRule; onClose: () => void }) {
  const accs = save.finance.accounts.filter((a) => !a.archived);
  const [name, setName] = useState(rule?.name ?? '');
  const [kind, setKind] = useState<'income' | 'expense'>(rule?.kind ?? 'expense');
  const [amount, setAmount] = useState<Cents | null>(rule?.amount ?? null);
  const [accountId, setAcc] = useState(rule?.accountId ?? accs[0]?.id ?? '');
  const [categoryId, setCat] = useState(rule?.categoryId ?? '');
  const [frequency, setFreq] = useState<RecurringRule['frequency']>(rule?.frequency ?? 'monthly');
  const [day, setDay] = useState(rule?.day ?? 10);
  const [startDate, setStart] = useState(rule?.startDate ?? todayISO());
  const [endDate, setEnd] = useState(rule?.endDate ?? '');
  const [isSubscription, setSubs] = useState(rule?.isSubscription ?? false);
  const [active, setActive] = useState(rule?.active ?? true);
  if (!accs.length) return <Modal title="Nova recorrência" onClose={onClose}><p className="small">Cadastre uma conta primeiro.</p></Modal>;
  return (
    <Modal title={rule ? 'Editar recorrência' : 'Nova conta fixa / assinatura'} onClose={onClose}>
      <Seg value={kind} onChange={setKind} options={[{ id: 'expense', label: 'Despesa fixa' }, { id: 'income', label: 'Receita fixa' }]} />
      <label>Nome</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Internet, Aluguel, Salário" autoFocus />
      <div className="grid2">
        <div><label>Valor</label><MoneyInput value={amount} onChange={setAmount} /></div>
        <div><label>Conta</label><select value={accountId} onChange={(e) => setAcc(e.target.value)}>{accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
        <div><label>Frequência</label><select value={frequency} onChange={(e) => setFreq(e.target.value as RecurringRule['frequency'])}><option value="monthly">Mensal</option><option value="weekly">Semanal</option><option value="yearly">Anual</option></select></div>
        <div><label>{frequency === 'weekly' ? 'Dia (ignorado: usa a data inicial)' : 'Dia do vencimento'}</label><input type="number" min={1} max={31} value={day} onChange={(e) => setDay(Number(e.target.value))} /></div>
        <div><label>Começa em</label><input type="date" value={startDate} onChange={(e) => setStart(e.target.value)} /></div>
        <div><label>Termina em (opcional)</label><input type="date" value={endDate} onChange={(e) => setEnd(e.target.value)} /></div>
      </div>
      <label>Categoria</label>
      <select value={categoryId} onChange={(e) => setCat(e.target.value)}><option value="">Sem categoria</option>{save.finance.categories.filter((c) => c.kind === kind).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <label className="row" style={{ color: 'var(--ink)' }}><input type="checkbox" checked={isSubscription} onChange={(e) => setSubs(e.target.checked)} style={{ width: 'auto' }} /> É uma assinatura (streaming, app, academia…)</label>
      <label className="row" style={{ color: 'var(--ink)' }}><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} style={{ width: 'auto' }} /> Ativa</label>
      <div className="tiny muted">Recorrências aparecem no calendário e na projeção. Cada ocorrência só vira lançamento quando você confirmar.</div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={!amount || !name.trim()} onClick={() => { const ok = act(() => { A.saveRecurring({ id: rule?.id, name, kind, amount: amount!, accountId, categoryId: categoryId || undefined, frequency, day, startDate, endDate: endDate || undefined, isSubscription, active }); return true; }, 'Salvo'); if (ok) onClose(); }}>Salvar</button>
      </div>
    </Modal>
  );
}

function RecurringView({ save }: { save: SaveData }) {
  const [form, setForm] = useState<{ rule?: RecurringRule } | null>(null);
  const [del, setDel] = useState<RecurringRule | null>(null);
  const rules = save.finance.recurring;
  const monthlyOut = rules.filter((r) => r.active && r.kind === 'expense').reduce((s, r) => s + (r.frequency === 'monthly' ? r.amount : r.frequency === 'weekly' ? Math.round(r.amount * 52 / 12) : Math.round(r.amount / 12)), 0);
  const subs = rules.filter((r) => r.active && r.isSubscription && r.kind === 'expense');
  return (
    <>
      <div className="row between"><div className="small">Despesas fixas por mês: <b>{formatBRL(monthlyOut)}</b>{subs.length ? ` · ${subs.length} assinaturas` : ''}</div><button className="btn sm primary" onClick={() => setForm({})}>+ Nova</button></div>
      <div className="list" style={{ marginTop: 8 }}>
        {rules.map((r) => (
          <div key={r.id} className="li" style={{ opacity: r.active ? 1 : 0.5 }}>
            <div className="grow"><b>{r.name}</b> {r.isSubscription && <span className="chip">assinatura</span>}<div className="tiny muted">{r.frequency === 'monthly' ? `todo dia ${r.day}` : r.frequency === 'weekly' ? 'semanal' : `anual, dia ${r.day}`} · desde {formatDateBR(r.startDate)}{r.endDate ? ` até ${formatDateBR(r.endDate)}` : ''}</div></div>
            <span className={`amount ${r.kind === 'income' ? 'pos' : 'neg'}`}>{formatBRL(r.amount)}</span>
            <button className="btn sm" onClick={() => setForm({ rule: r })}>✎</button>
            <button className="btn sm danger" onClick={() => setDel(r)}>✕</button>
          </div>
        ))}
        {!rules.length && <div className="small muted">Cadastre aluguel, internet, assinaturas e salário para ver o calendário e a projeção.</div>}
      </div>
      {form && <RecurringForm save={save} rule={form.rule} onClose={() => setForm(null)} />}
      {del && <Confirm title="Excluir recorrência?" text="Lançamentos já confirmados continuam. Só as ocorrências futuras deixam de aparecer." yes="Excluir" danger onClose={() => setDel(null)} onYes={() => act(() => A.deleteRecurring(del.id), 'Excluída')} />}
    </>
  );
}

/* ---------- metas ---------- */

function GoalForm({ save, goal, onClose }: { save: SaveData; goal?: Goal; onClose: () => void }) {
  const avg = averageMonthlyExpense(save.finance);
  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState<Cents | null>(goal?.target ?? null);
  const [accountId, setAcc] = useState(goal?.accountId ?? '');
  const [deadline, setDeadline] = useState(goal?.deadline ?? '');
  const [isEmergency, setEm] = useState(goal?.isEmergency ?? false);
  return (
    <Modal title={goal ? 'Editar meta' : 'Nova meta de economia'} onClose={onClose}>
      <label>Nome</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Reserva, Notebook, Viagem" autoFocus />
      <label>Valor alvo</label><MoneyInput value={target} onChange={setTarget} />
      <label>Acompanhar pelo saldo da conta</label>
      <select value={accountId} onChange={(e) => setAcc(e.target.value)}>
        <option value="">Patrimônio líquido total</option>
        {save.finance.accounts.filter((a) => !isLiability(a.type)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <label>Prazo (opcional)</label><input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      <label className="row" style={{ color: 'var(--ink)' }}><input type="checkbox" checked={isEmergency} onChange={(e) => { setEm(e.target.checked); if (e.target.checked && avg > 0 && !target) setTarget(avg * 6); }} style={{ width: 'auto' }} /> Reserva de emergência {avg > 0 && <span className="tiny muted">(sugestão: 6x {formatBRL(avg)} = {formatBRL(avg * 6)})</span>}</label>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={!target || !name.trim()} onClick={() => { const ok = act(() => { A.saveGoal({ id: goal?.id, name, target: target!, accountId: accountId || undefined, deadline: deadline || undefined, isEmergency }); return true; }, 'Meta salva'); if (ok) onClose(); }}>Salvar</button>
      </div>
    </Modal>
  );
}

function GoalsView({ save }: { save: SaveData }) {
  const [form, setForm] = useState<{ goal?: Goal } | null>(null);
  const [del, setDel] = useState<Goal | null>(null);
  return (
    <>
      <div className="row between"><b>Metas</b><button className="btn sm primary" onClick={() => setForm({})}>+ Meta</button></div>
      <div className="list" style={{ marginTop: 8 }}>
        {save.finance.goals.map((g) => {
          const cur = goalProgress(save.finance, g);
          const done = cur >= g.target;
          const months = g.deadline ? Math.max(1, Math.ceil((new Date(g.deadline).getTime() - Date.now()) / (30 * 86400000))) : 0;
          return (
            <div key={g.id} className="card">
              <div className="row between"><b>{g.name}{g.isEmergency ? ' · emergência' : ''}</b>{done ? <span className="chip pos">CONCLUÍDA</span> : null}</div>
              <div style={{ marginTop: 6 }}><Progress value={cur} max={g.target} kind="gold" /></div>
              <div className="row between tiny muted" style={{ marginTop: 3 }}><span>{formatBRL(cur)} de {formatBRL(g.target)} ({Math.min(100, Math.round((cur / g.target) * 100))}%)</span>{g.deadline && <span>até {formatDateBR(g.deadline)}</span>}</div>
              {!done && months > 0 && <div className="tiny muted">Para chegar no prazo: {formatBRL(Math.ceil((g.target - cur) / months))} por mês.</div>}
              <div className="row" style={{ marginTop: 6 }}><button className="btn sm" onClick={() => setForm({ goal: g })}>Editar</button><button className="btn sm danger" onClick={() => setDel(g)}>Excluir</button></div>
            </div>
          );
        })}
        {!save.finance.goals.length && <div className="small muted">Crie uma meta. Ligue-a a uma conta (ex.: Reserva) para o progresso andar sozinho.</div>}
      </div>
      {form && <GoalForm save={save} goal={form.goal} onClose={() => setForm(null)} />}
      {del && <Confirm title="Excluir meta?" text="Os lançamentos não são afetados." yes="Excluir" danger onClose={() => setDel(null)} onYes={() => act(() => A.deleteGoal(del.id), 'Meta excluída')} />}
    </>
  );
}

/* ---------- orçamento ---------- */

function BudgetView({ save }: { save: SaveData }) {
  const mk = monthKey(todayISO());
  const ms = monthSummary(save.finance, mk);
  const [editing, setEditing] = useState<string | null>(null);
  const [val, setVal] = useState<Cents | null>(null);
  const cats = save.finance.categories.filter((c) => c.kind === 'expense');
  const totalBudget = save.finance.budgets.reduce((s, b) => s + b.limit, 0);
  return (
    <>
      <div className="small">Limites de gasto por categoria neste mês. Total orçado: <b>{formatBRL(totalBudget)}</b> · gasto: <b>{formatBRL(ms.expense)}</b></div>
      <div className="list" style={{ marginTop: 8 }}>
        {cats.map((c) => {
          const b = save.finance.budgets.find((x) => x.categoryId === c.id);
          const spent = ms.byCategory.get(c.id) ?? 0;
          return (
            <div key={c.id} className="li" style={{ flexWrap: 'wrap' }}>
              <span className="dot" style={{ background: c.color }} />
              <div className="grow" style={{ minWidth: 140 }}>
                <div className="row between"><b className="small">{c.name}</b><span className="tiny">{formatBRL(spent)}{b ? ` / ${formatBRL(b.limit)}` : ''}</span></div>
                {b && <Progress value={spent} max={b.limit} kind={spent > b.limit ? 'red' : spent > b.limit * 0.8 ? 'gold' : ''} />}
                {b && spent > b.limit && <div className="tiny neg">Estourou em {formatBRL(spent - b.limit)}</div>}
              </div>
              {editing === c.id ? (
                <div className="row" style={{ width: '100%' }}>
                  <MoneyInput value={val} onChange={setVal} autoFocus />
                  <button className="btn sm primary" onClick={() => { act(() => A.setBudget({ categoryId: c.id, limit: val ?? 0 })); setEditing(null); }}>OK</button>
                  {b && <button className="btn sm danger" onClick={() => { act(() => A.setBudget({ categoryId: c.id, limit: null })); setEditing(null); }}>Remover</button>}
                </div>
              ) : <button className="btn sm" onClick={() => { setEditing(c.id); setVal(b?.limit ?? null); }}>{b ? 'Editar' : 'Definir limite'}</button>}
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------- categorias ---------- */

function CategoriesView({ save }: { save: SaveData }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [color, setColor] = useState('#a78bfa');
  const [del, setDel] = useState<string | null>(null);
  return (
    <>
      <div className="card">
        <b>Nova categoria</b>
        <div className="row wrap" style={{ marginTop: 6 }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" style={{ flex: 2, minWidth: 120 }} />
          <select value={kind} onChange={(e) => setKind(e.target.value as 'income' | 'expense')} style={{ flex: 1, minWidth: 100 }}><option value="expense">Despesa</option><option value="income">Receita</option></select>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 48, padding: 2 }} />
          <button className="btn primary" disabled={!name.trim()} onClick={() => { act(() => A.saveCategory({ name: name.trim(), kind, color, icon: 'tag' }), 'Categoria criada'); setName(''); }}>Criar</button>
        </div>
      </div>
      <div className="list" style={{ marginTop: 8 }}>
        {save.finance.categories.map((c) => (
          <div key={c.id} className="li">
            <span className="dot" style={{ background: c.color }} />
            <span className="grow">{c.name} <span className="tiny muted">· {c.kind === 'income' ? 'receita' : 'despesa'}{c.system ? ' · padrão' : ''}</span></span>
            {!c.system && <button className="btn sm danger" onClick={() => setDel(c.id)}>✕</button>}
          </div>
        ))}
      </div>
      {del && <Confirm title="Excluir categoria?" text="Lançamentos dessa categoria ficam sem categoria." yes="Excluir" danger onClose={() => setDel(null)} onYes={() => act(() => A.deleteCategory(del), 'Excluída')} />}
    </>
  );
}

export { addDays };
