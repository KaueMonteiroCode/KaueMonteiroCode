import { useRef, useState } from 'react';
import { decodeTransfer, encodeTransfer } from '../core/transfer';
import { todayISO } from '../core/dates';
import { normalizeSave } from '../state/defaults';
import { mergeSaves, type MergeSummary } from '../state/merge';
import { applyMerged, flush, getState, undoRestore } from '../state/store';
import type { SaveData } from '../state/types';
import { errToast, ExportBox, Modal, toast } from './common';

/** Levar os dados para outro aparelho: código cifrado com senha e junção sem perder nada. */
export function SyncCard() {
  const [mode, setMode] = useState<'' | 'send' | 'receive'>('');
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [incoming, setIncoming] = useState('');
  const [preview, setPreview] = useState<{ merged: SaveData; summary: MergeSummary } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const reset = () => { setMode(''); setPass(''); setPass2(''); setIncoming(''); setPreview(null); setBusy(false); };

  return (
    <div className="card">
      <b>Sincronizar com outro aparelho</b>
      <p className="small muted" style={{ lineHeight: 1.6 }}>Leve seus dados do PC para o celular (ou o contrário) sem servidor: o jogo gera um <b>código protegido por senha</b>. No outro aparelho, cole o código e os dados são <b>somados</b>: lançamentos dos dois lados ficam, nada é apagado.</p>
      <div className="row wrap">
        <button className="btn primary" onClick={() => setMode('send')}>Gerar código</button>
        <button className="btn" onClick={() => setMode('receive')}>Receber código</button>
      </div>

      {mode === 'send' && !code && (
        <Modal title="Gerar código" onClose={reset}>
          <div className="small muted">Escolha uma senha. Você vai digitá-la no outro aparelho. Sem ela, ninguém abre o código.</div>
          <label htmlFor="sync-p1">Senha (mínimo 6 caracteres)</label><input id="sync-p1" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoFocus />
          <label htmlFor="sync-p2">Repita a senha</label><input id="sync-p2" type="password" value={pass2} onChange={(e) => setPass2(e.target.value)} />
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn primary" disabled={busy || pass.length < 6 || pass !== pass2} onClick={async () => {
              setBusy(true);
              try { await flush(); setCode(await encodeTransfer(getState(), pass)); } catch (e) { errToast(e); }
              setBusy(false);
            }}>{busy ? 'Gerando…' : 'Gerar'}</button>
          </div>
        </Modal>
      )}
      {code && <ExportBox title="Seu código de transferência" filename={`colchao-imperio-codigo-${todayISO()}.txt`} mime="text/plain" content={code} onClose={() => { setCode(null); reset(); }} note="Copie e mande para você mesmo (WhatsApp, e-mail). No outro aparelho: Ajustes → Sincronizar → Receber código, cole e digite a senha." />}

      {mode === 'receive' && !preview && (
        <Modal title="Receber código" onClose={reset}>
          <label htmlFor="sync-in">Cole o código</label>
          <textarea id="sync-in" rows={5} value={incoming} onChange={(e) => setIncoming(e.target.value)} placeholder="CIMP1:…" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }} />
          <button className="btn sm" style={{ marginTop: 6 }} onClick={() => fileRef.current?.click()}>Ou abrir arquivo .txt</button>
          <input ref={fileRef} type="file" accept=".txt,text/plain" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setIncoming(await f.text()); }} />
          <label htmlFor="sync-pin">Senha</label><input id="sync-pin" type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn primary" disabled={busy || !incoming.trim() || !pass} onClick={async () => {
              setBusy(true);
              try {
                const remote = normalizeSave(await decodeTransfer(incoming, pass));
                setPreview(mergeSaves(getState(), remote));
              } catch (e) { errToast(e); }
              setBusy(false);
            }}>{busy ? 'Abrindo…' : 'Ver o que muda'}</button>
          </div>
        </Modal>
      )}
      {preview && (
        <Modal title="Juntar dados" onClose={reset}>
          <ul className="small" style={{ lineHeight: 1.8, paddingLeft: 18 }}>
            <li><b>{preview.summary.newTx}</b> lançamento(s) novo(s) e <b>{preview.summary.updatedTx}</b> atualizado(s)</li>
            <li><b>{preview.summary.newAccounts}</b> conta(s), <b>{preview.summary.newGoals}</b> meta(s), <b>{preview.summary.newRecurring}</b> recorrência(s) novas</li>
            <li>Decoração, compras e personagem: do <b>{preview.summary.gameFrom}</b> (o usado por último)</li>
          </ul>
          <div className="small muted">Missões resgatadas e dias com registro dos dois aparelhos são somados. Dá para desfazer logo depois.</div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn ghost" onClick={reset}>Cancelar</button>
            <button className="btn primary" onClick={async () => {
              await applyMerged(preview.merged);
              toast('Dados juntados!', { kind: 'ok', ms: 8000, action: { label: 'Desfazer', run: () => { void undoRestore().then((ok) => toast(ok ? 'Junção desfeita' : 'Nada para desfazer')); } } });
              reset();
            }}>Juntar dados</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
