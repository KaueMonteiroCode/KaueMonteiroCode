import { useMemo, useState } from 'react';
import { formatBRL, type Cents } from '../core/money';
import { todayISO } from '../core/dates';
import { balancesAt } from '../finance/ledger';
import { savingsCoins } from '../game/rewards';
import { computeProgress } from '../game/progress';
import * as A from '../state/actions';
import type { SaveData } from '../state/types';
import { isLiability } from '../state/types';
import { act, Coins, Modal, MoneyInput, Seg } from './common';

/** Registro rápido de economia, com explicação honesta do que gera moedas. */
export function SavingDialog({ save, onClose }: { save: SaveData; onClose: () => void }) {
  const assets = save.finance.accounts.filter((a) => !a.archived && !isLiability(a.type));
  const [mode, setMode] = useState<'new-money' | 'move'>('new-money');
  const [amount, setAmount] = useState<Cents | null>(null);
  const reserve = assets.find((a) => a.type === 'reserve') ?? assets.find((a) => a.type === 'savings');
  const [acc, setAcc] = useState<string>(reserve?.id ?? assets[0]?.id ?? '__new');
  const [from, setFrom] = useState<string>(assets.find((a) => a.id !== (reserve?.id ?? ''))?.id ?? '');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(todayISO());
  const bal = useMemo(() => balancesAt(save.finance), [save]);
  const prog = computeProgress(save);

  const preview = useMemo(() => {
    if (!amount || mode !== 'new-money') return 0;
    const peak = prog.metrics.peakGain;
    const cur = prog.metrics.currentGain;
    const newGain = cur + amount;
    return newGain > peak ? savingsCoins(newGain) - savingsCoins(peak) : 0;
  }, [amount, mode, prog]);

  const submit = () => {
    if (!amount) return;
    const ok = act(() => {
      let target = acc;
      if (target === '__new') target = A.addAccount({ name: 'Cofrinho', type: 'reserve', initialAmount: 0 });
      if (mode === 'move' && !from) throw new Error('Escolha de qual conta o dinheiro saiu.');
      A.registerSaving({ amount, accountId: target, mode, fromAccountId: from, description: desc, date });
      return true;
    });
    if (ok) onClose();
  };

  return (
    <Modal title="Registrar economia" onClose={onClose}>
      <Seg value={mode} onChange={setMode} options={[{ id: 'new-money', label: 'Guardei dinheiro' }, { id: 'move', label: 'Movi entre contas' }]} />
      <div className="hint" style={{ marginTop: 10 }}>
        {mode === 'new-money'
          ? <>Dinheiro que entrou no seu patrimônio e <b>ainda não estava registrado</b>: troco no cofrinho, sobra do mês, algo que você deixou de gastar e guardou. Aparece como <b>Economia guardada</b>, separada das receitas.</>
          : <>Transferência entre suas contas (ex.: da corrente para a reserva). Ótimo hábito, conta para missões, mas <b>não gera moedas</b>: seu patrimônio total não mudou.</>}
      </div>
      <label htmlFor="sv-amt">Valor</label>
      <MoneyInput id="sv-amt" value={amount} onChange={setAmount} autoFocus />
      {mode === 'move' && (
        <>
          <label>Saiu de</label>
          <select value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">Escolha…</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.name} ({formatBRL(bal.get(a.id) ?? 0)})</option>)}
          </select>
        </>
      )}
      <label>{mode === 'move' ? 'Foi para' : 'Onde esse dinheiro está guardado'}</label>
      <select value={acc} onChange={(e) => setAcc(e.target.value)}>
        {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        <option value="__new">+ Criar "Cofrinho" (reserva)</option>
      </select>
      <div className="grid2">
        <div><label>Data</label><input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></div>
        <div><label>Descrição (opcional)</label><input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex.: troco do mercado" /></div>
      </div>
      <div className="row between" style={{ marginTop: 14 }}>
        <div className="small">
          {mode === 'new-money' && amount ? (preview > 0 ? <>Previsão: <Coins n={preview} className="gold" /> + conquistas</> : <span className="muted">Sem moedas novas: você ainda está recuperando um pico anterior.</span>) : null}
        </div>
        <button className="btn primary" disabled={!amount || (mode === 'move' && (!from || from === acc))} onClick={submit}>Registrar</button>
      </div>
    </Modal>
  );
}
