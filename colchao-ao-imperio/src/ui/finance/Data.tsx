import { useRef, useState } from 'react';
import { formatDateBR, todayISO } from '../../core/dates';
import { formatBRL } from '../../core/money';
import { exportCSV, interpretStatement, type ImportRow } from '../../finance/csv';
import * as A from '../../state/actions';
import type { SaveData } from '../../state/types';
import { act, errToast, ExportBox, Modal, toast } from '../common';

export function DataView({ save }: { save: SaveData }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [acc, setAcc] = useState(save.finance.accounts[0]?.id ?? '');
  const [skipDup, setSkipDup] = useState(true);
  const [incDeleted, setIncDeleted] = useState(false);
  const [csv, setCsv] = useState<string | null>(null);

  const doImport = () => {
    if (!rows) return;
    let n = 0, skipped = 0;
    const cats = save.finance.categories;
    const accs = save.finance.accounts;
    for (const r of rows) {
      if (r.error || (skipDup && r.duplicate)) { skipped++; continue; }
      const catId = r.categoryName ? cats.find((c) => c.name.toLowerCase() === r.categoryName!.toLowerCase())?.id : undefined;
      const accId = (r.accountName && accs.find((a) => a.name.toLowerCase() === r.accountName!.toLowerCase())?.id) || acc;
      const ok = act(() => { A.addTransaction({ kind: r.kind, amount: r.amount, date: r.date, accountId: accId, categoryId: catId, description: r.description, status: r.date > todayISO() ? 'pending' : 'confirmed', tags: r.extId ? [`ext:${r.extId}`] : undefined }); return true; });
      if (ok) n++; else skipped++;
    }
    toast(`${n} lançamentos importados${skipped ? `, ${skipped} ignorados` : ''}.`, { kind: 'ok' });
    setRows(null);
  };

  return (
    <>
      <div className="card">
        <b>Exportar CSV</b>
        <p className="small muted">Planilha com todos os lançamentos (separador ";", valores com vírgula, abre no Excel/LibreOffice/Google Planilhas).</p>
        <label className="row small"><input type="checkbox" checked={incDeleted} onChange={(e) => setIncDeleted(e.target.checked)} style={{ width: 'auto' }} /> Incluir excluídos</label>
        <button className="btn primary" onClick={() => { setCsv(exportCSV(save.finance, incDeleted)); A.visit('csv-export'); }}>Exportar CSV</button>
      </div>
      <div className="card">
        <b>Importar extrato (OFX ou CSV)</b>
        <p className="small muted">Aceita <b>OFX</b> (no app do banco: Extrato → Exportar → OFX) e <b>CSV</b> do Nubank (conta e fatura do cartão), Inter, Itaú ou qualquer planilha com colunas de data e valor (negativo = despesa). Lançamentos já importados são reconhecidos e não duplicam. Você revisa tudo antes de confirmar.</p>
        <label>Conta padrão para as linhas sem conta</label>
        <select value={acc} onChange={(e) => setAcc(e.target.value)}>{save.finance.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <button className="btn" style={{ marginTop: 8 }} disabled={!acc} onClick={() => fileRef.current?.click()}>Escolher arquivo do extrato</button>
        {!save.finance.accounts.length && <div className="small neg">Cadastre uma conta antes de importar.</div>}
        <input ref={fileRef} type="file" accept=".csv,.ofx,.txt,text/csv" style={{ display: 'none' }} onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = '';
          if (!f) return;
          try { setRows(interpretStatement(await f.text(), save.finance)); } catch (err) { errToast(err); }
        }} />
      </div>
      <div className="card">
        <b>Histórico de alterações (auditoria)</b>
        <div className="list" style={{ marginTop: 6, maxHeight: 320, overflowY: 'auto' }}>
          {[...save.finance.audit].reverse().slice(0, 200).map((a, i) => (
            <div key={i} className="small" style={{ borderBottom: '1px solid var(--line)', padding: '4px 0' }}>
              <span className="muted">{new Date(a.at).toLocaleString('pt-BR')}</span> · <b>{a.action}</b><div className="tiny muted ellipsis">{a.detail}</div>
            </div>
          ))}
          {!save.finance.audit.length && <div className="small muted">Nada registrado ainda.</div>}
        </div>
      </div>
      {csv != null && <ExportBox title="Exportar lançamentos" filename={`lancamentos-${todayISO()}.csv`} mime="text/csv;charset=utf-8" content={csv} onClose={() => setCsv(null)} />}
      {rows && (
        <Modal title="Revisar importação" onClose={() => setRows(null)} wide>
          <div className="small">{rows.filter((r) => !r.error).length} válidas · {rows.filter((r) => r.error).length} com erro · {rows.filter((r) => r.duplicate).length} possíveis duplicadas</div>
          <label className="row small"><input type="checkbox" checked={skipDup} onChange={(e) => setSkipDup(e.target.checked)} style={{ width: 'auto' }} /> Ignorar possíveis duplicadas</label>
          <div style={{ maxHeight: 340, overflowY: 'auto', marginTop: 8 }}>
            <table className="tbl">
              <thead><tr><th>Linha</th><th>Data</th><th>Tipo</th><th>Descrição</th><th className="r">Valor</th><th /></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.line} style={{ opacity: r.error || (skipDup && r.duplicate) ? 0.5 : 1 }}>
                  <td>{r.line}</td><td>{r.date ? formatDateBR(r.date) : '—'}</td><td>{r.kind === 'income' ? 'receita' : r.kind === 'expense' ? 'despesa' : r.kind}</td>
                  <td className="ellipsis" style={{ maxWidth: 180 }}>{r.description}</td><td className="r">{formatBRL(r.amount)}</td>
                  <td className="tiny">{r.error ? <span className="neg">{r.error}</span> : r.duplicate ? <span className="gold">duplicada?</span> : ''}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="hint" style={{ marginTop: 8 }}>Transferências no CSV são importadas como despesa e devem ser revisadas, para evitar contar a mesma movimentação duas vezes.</div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn ghost" onClick={() => setRows(null)}>Cancelar</button>
            <button className="btn primary" onClick={doImport}>Importar</button>
          </div>
        </Modal>
      )}
    </>
  );
}
