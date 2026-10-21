import { useRef, useState } from 'react';
import { todayISO } from '../core/dates';
import * as A from '../state/actions';
import { eraseEverything, flush, getState, replaceState } from '../state/store';
import type { SaveData } from '../state/types';
import { act, Confirm, Drawer, errToast, toast } from './common';

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SettingsPanel({ save, onClose, onExit }: { save: SaveData; onClose: () => void; onExit: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<unknown>(null);
  const [wipe, setWipe] = useState(0);
  const s = save.settings;
  const toggle = (k: keyof typeof s) => act(() => A.setSettings({ [k]: !s[k] }));

  return (
    <Drawer title="Ajustes e backup" icon="gear" onClose={onClose}>
      <div className="card">
        <b>Jogo</b>
        {([['sound', 'Efeitos sonoros'], ['music', 'Música ambiente lo-fi'], ['reduceMotion', 'Reduzir animações'], ['showGrid', 'Mostrar grade no chão']] as const).map(([k, l]) => (
          <label key={k} className="row" style={{ fontSize: 14, color: 'var(--ink)' }}><input type="checkbox" checked={s[k]} onChange={() => toggle(k)} style={{ width: 'auto' }} /> {l}</label>
        ))}
      </div>
      <div className="card">
        <b>Backup e restauração</b>
        <p className="small muted" style={{ lineHeight: 1.6 }}>Seus dados ficam só neste navegador (IndexedDB). Faça backups para não perder nada se limpar o navegador ou trocar de computador.</p>
        <div className="row wrap">
          <button className="btn primary" onClick={async () => { await flush(); downloadFile(`colchao-imperio-backup-${todayISO()}.json`, JSON.stringify(getState(), null, 2), 'application/json'); A.visit('backup'); toast('Backup baixado!', { kind: 'ok', icon: 'save' }); }}>Baixar backup (.json)</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Restaurar backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = '';
            if (!f) return;
            try { setPending(JSON.parse(await f.text())); } catch (err) { errToast(new Error('Arquivo inválido: ' + (err as Error).message)); }
          }} />
        </div>
      </div>
      <div className="card">
        <b>Privacidade</b>
        <ul className="small muted" style={{ lineHeight: 1.7, paddingLeft: 18 }}>
          <li>Nenhuma conexão bancária, nenhuma senha, nenhum servidor.</li>
          <li>O jogo nunca movimenta dinheiro real: moedas virtuais são só do jogo.</li>
          <li>Você pode exportar (backup/CSV) e apagar tudo quando quiser.</li>
        </ul>
        <button className="btn danger" onClick={() => setWipe(1)}>Apagar todos os meus dados</button>
      </div>
      <div className="card">
        <b>Sobre</b>
        <div className="small muted">Do Colchão ao Império · v0.1 · {save.finance.transactions.length} lançamentos · criado em {new Date(save.createdAt).toLocaleDateString('pt-BR')}</div>
        <button className="btn sm" style={{ marginTop: 8 }} onClick={onExit}>Voltar à tela inicial</button>
      </div>
      {pending != null && <Confirm title="Restaurar backup?" text="Isso SUBSTITUI todos os dados atuais pelos do arquivo. Recomendo baixar um backup do estado atual antes." yes="Substituir" danger onClose={() => setPending(null)} onYes={() => { try { replaceState(pending); toast('Backup restaurado!', { kind: 'ok' }); } catch (err) { errToast(err); } }} />}
      {wipe === 1 && <Confirm title="Apagar tudo?" text="Lançamentos, contas, móveis e progresso serão apagados deste navegador. Não há como desfazer sem um backup." yes="Continuar" danger onClose={() => setWipe(0)} onYes={() => setTimeout(() => setWipe(2), 50)} />}
      {wipe === 2 && <Confirm title="Tem certeza absoluta?" text="Última confirmação. Tudo será apagado agora." yes="Apagar definitivamente" danger onClose={() => setWipe(0)} onYes={async () => { await eraseEverything(); onExit(); }} />}
    </Drawer>
  );
}
