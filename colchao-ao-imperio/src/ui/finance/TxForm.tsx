import { useState } from 'react';
import { todayISO } from '../../core/dates';
import { formatBRL, type Cents } from '../../core/money';
import * as A from '../../state/actions';
import type { SaveData, Transaction } from '../../state/types';
import { isLiability } from '../../state/types';
import { act, Modal, MoneyInput, Seg } from '../common';

export function TxForm({ save, tx, preset, onClose }: { save: SaveData; tx?: Transaction; preset?: Partial<A.TxInput>; onClose: () => void }) {
  const accs = save.finance.accounts.filter((a) => !a.archived || a.id === tx?.accountId || a.id === tx?.toAccountId);
  const [kind, setKind] = useState<Transaction['kind']>(tx?.kind ?? preset?.kind ?? 'expense');
  const [amount, setAmount] = useState<Cents | null>(tx?.amount ?? preset?.amount ?? null);
  const [date, setDate] = useState(tx?.date ?? preset?.date ?? todayISO());
  const [accountId, setAccount] = useState(tx?.accountId ?? preset?.accountId ?? accs[0]?.id ?? '');
  const [toAccountId, setTo] = useState(tx?.toAccountId ?? preset?.toAccountId ?? '');
  const [categoryId, setCat] = useState(tx?.categoryId ?? preset?.categoryId ?? '');
  const [description, setDesc] = useState(tx?.description ?? preset?.description ?? '');
  const [installments, setInst] = useState(tx?.installments?.count ?? 1);
  const [saving, setSaving] = useState(tx?.saving ?? preset?.saving ?? false);
  const [adjSign, setAdjSign] = useState<1 | -1>(tx && tx.kind === 'adjustment' && tx.amount < 0 ? -1 : 1);
  const acc = accs.find((a) => a.id === accountId);
  const cats = save.finance.categories.filter((c) => c.kind === (kind === 'income' ? 'income' : 'expense'));

  if (!accs.length) {
    return <Modal title="Novo lançamento" onClose={onClose}><p className="small">Cadastre uma conta primeiro (aba Contas). Pode ser só "Carteira".</p></Modal>;
  }

  const submit = () => {
    if (amount == null) return;
    const input: A.TxInput = {
      kind, amount: kind === 'adjustment' ? Math.abs(amount) * adjSign : amount, date, accountId,
      toAccountId: kind === 'transfer' ? toAccountId : undefined, categoryId: kind === 'transfer' || kind === 'adjustment' ? undefined : categoryId || undefined,
      description, installments: kind === 'expense' && acc?.type === 'credit_card' ? installments : 1, saving: kind === 'income' ? saving : undefined,
    };
    const ok = act(() => { if (tx) A.editTransaction(tx.id, input); else A.addTransaction(input); return true; }, tx ? 'Lançamento corrigido' : 'Lançamento registrado');
    if (ok) onClose();
  };

  return (
    <Modal title={tx ? 'Corrigir lançamento' : 'Novo lançamento'} onClose={onClose}>
      <Seg value={kind} onChange={setKind} options={[{ id: 'expense', label: 'Despesa' }, { id: 'income', label: 'Receita' }, { id: 'transfer', label: 'Transferência' }, { id: 'adjustment', label: 'Ajuste' }]} />
      {kind === 'transfer' && <div className="hint" style={{ marginTop: 8 }}>Movimento entre suas contas: pagar fatura, pagar dívida, guardar na reserva, receber empréstimo (da conta Dívida para a corrente). Não altera seu patrimônio.</div>}
      {kind === 'adjustment' && <div className="hint warn" style={{ marginTop: 8 }}>Use para corrigir o saldo de uma conta quando ele não bate com o banco. Ajustes para cima não geram moedas.</div>}
      <label>Valor</label>
      <MoneyInput value={amount} onChange={setAmount} autoFocus />
      {kind === 'adjustment' && <div style={{ marginTop: 6 }}><Seg value={adjSign === 1 ? 'mais' : 'menos'} onChange={(v) => setAdjSign(v === 'mais' ? 1 : -1)} options={[{ id: 'mais', label: 'Aumentar saldo' }, { id: 'menos', label: 'Diminuir saldo' }]} /></div>}
      <div className="grid2">
        <div><label>Data</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div>
          <label>{kind === 'transfer' ? 'De (origem)' : 'Conta'}</label>
          <select value={accountId} onChange={(e) => setAccount(e.target.value)}>
            {accs.map((a) => <option key={a.id} value={a.id}>{a.name}{isLiability(a.type) ? ' (passivo)' : ''}</option>)}
          </select>
        </div>
      </div>
      {kind === 'transfer' && (
        <><label>Para (destino)</label>
          <select value={toAccountId} onChange={(e) => setTo(e.target.value)}>
            <option value="">Escolha…</option>
            {accs.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></>
      )}
      {(kind === 'income' || kind === 'expense') && (
        <><label>Categoria</label>
          <select value={categoryId} onChange={(e) => setCat(e.target.value)}>
            <option value="">Sem categoria</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></>
      )}
      <label>Descrição</label>
      <input value={description} onChange={(e) => setDesc(e.target.value)} placeholder={kind === 'expense' ? 'Ex.: mercado' : 'Ex.: salário'} />
      {kind === 'income' && <label className="row" style={{ color: 'var(--ink)' }}><input type="checkbox" checked={saving} onChange={(e) => setSaving(e.target.checked)} style={{ width: 'auto' }} /> É uma economia guardada (não é salário/renda)</label>}
      {kind === 'expense' && acc?.type === 'credit_card' && (
        <><label>Parcelas</label>
          <select value={installments} onChange={(e) => setInst(Number(e.target.value))}>
            {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 1 ? 'À vista' : `${n}x de ${amount ? formatBRL(Math.floor(amount / n)) : '—'}`}</option>)}
          </select>
          <div className="tiny muted" style={{ marginTop: 4 }}>O valor total entra como dívida do cartão hoje; as parcelas aparecem nas faturas futuras.</div></>
      )}
      {date > todayISO() && <div className="hint warn" style={{ marginTop: 8 }}>Data futura: ficará como <b>pendente</b> até você confirmar que aconteceu.</div>}
      {tx?.history?.length ? <div className="tiny muted" style={{ marginTop: 8 }}>Este lançamento já foi alterado {tx.history.length} vez(es). O histórico fica guardado.</div> : null}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn primary" disabled={amount == null || !accountId || (kind === 'transfer' && !toAccountId)} onClick={submit}>{tx ? 'Salvar correção' : 'Registrar'}</button>
      </div>
    </Modal>
  );
}
