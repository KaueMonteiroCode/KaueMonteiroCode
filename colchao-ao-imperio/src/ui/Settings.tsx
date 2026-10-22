import { useEffect, useRef, useState } from 'react';
import { todayISO } from '../core/dates';
import { saveFile } from '../core/download';
import { SyncCard } from './SyncPanel';
import { canInstall, isInstalled, onInstallChange, promptInstall, pwaSupported } from '../core/pwa';
import * as A from '../state/actions';
import { eraseEverything, flush, getState, replaceState, undoRestore } from '../state/store';
import type { SaveData } from '../state/types';
import { act, Confirm, Drawer, errToast, ExportBox, Modal, toast } from './common';

export function downloadFile(name: string, content: string, type: string) {
  void saveFile(name, content, type);
}

export function SettingsPanel({ save, onClose, onExit }: { save: SaveData; onClose: () => void; onExit: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<unknown>(null);
  const [wipe, setWipe] = useState(0);
  const [exp, setExp] = useState<string | null>(null);
  const [paste, setPaste] = useState<string | null>(null);
  const s = save.settings;
  const toggle = (k: keyof typeof s) => act(() => A.setSettings({ [k]: !s[k] }));

  return (
    <Drawer help="settings" title="Ajustes e backup" icon="gear" onClose={onClose}>
      <div className="card">
        <b>Jogo</b>
        {([['sound', 'Efeitos sonoros'], ['music', 'Música ambiente lo-fi'], ['reduceMotion', 'Reduzir animações'], ['showGrid', 'Mostrar grade no chão']] as const).map(([k, l]) => (
          <label key={k} className="row" style={{ fontSize: 14, color: 'var(--ink)' }}><input type="checkbox" checked={s[k]} onChange={() => toggle(k)} style={{ width: 'auto' }} /> {l}</label>
        ))}
      </div>
      <div className="card">
        <b>Atalhos de teclado (PC)</b>
        <div className="small muted" style={{ lineHeight: 1.8, marginTop: 4 }}>
          <kbd>E</kbd> Economizei · <kbd>F</kbd> Finanças · <kbd>L</kbd> Loja · <kbd>D</kbd> Decorar · <kbd>I</kbd> Inventário · <kbd>M</kbd> Missões · <kbd>C</kbd> Conquistas · <kbd>P</kbd> Personagem · <kbd>R</kbd> girar ao posicionar · <kbd>+</kbd>/<kbd>-</kbd> zoom · <kbd>Esc</kbd> fechar
        </div>
      </div>
      <InstallCard />
      <SyncCard />
      <div className="card">
        <b>Backup e restauração</b>
        <p className="small muted" style={{ lineHeight: 1.6 }}>Seus dados ficam só neste navegador (IndexedDB). Faça backups para não perder nada se limpar o navegador ou trocar de computador.</p>
        <div className="row wrap">
          <button className="btn primary" onClick={async () => { await flush(); setExp(JSON.stringify(getState())); A.visit('backup'); }}>Fazer backup</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>Restaurar de arquivo</button>
          <button className="btn" onClick={() => setPaste('')}>Restaurar colando texto</button>
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
      {exp != null && <ExportBox title="Backup dos seus dados" filename={`colchao-imperio-backup-${todayISO()}.json`} mime="application/json" content={exp} onClose={() => setExp(null)} note="Guarde este texto em lugar seguro. Para restaurar, use Restaurar colando texto." />}
      {paste != null && (
        <Modal title="Colar backup" onClose={() => setPaste(null)}>
          <textarea id="paste-backup" rows={8} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Cole aqui o texto do backup" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }} />
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn primary" disabled={!paste.trim()} onClick={() => { try { setPending(JSON.parse(paste)); setPaste(null); } catch { errToast(new Error('Texto inválido: copie o backup inteiro, do primeiro { ao último }.')); } }}>Continuar</button>
          </div>
        </Modal>
      )}
      {pending != null && <Confirm title="Restaurar backup?" text="Isso SUBSTITUI todos os dados atuais pelos do arquivo. Recomendo baixar um backup do estado atual antes." yes="Substituir" danger onClose={() => setPending(null)} onYes={async () => {
        try {
          const repairs = await replaceState(pending);
          toast('Backup restaurado!', { kind: 'ok', ms: 8000, sub: repairs.length ? `Reparos: ${repairs.join('; ')}` : undefined, action: { label: 'Desfazer', run: () => { void undoRestore().then((ok) => toast(ok ? 'Restauração desfeita' : 'Nada para desfazer')); } } });
        } catch (err) { errToast(err); }
      }} />}
      {wipe === 1 && <Confirm title="Apagar tudo?" text="Lançamentos, contas, móveis e progresso serão apagados deste navegador. Não há como desfazer sem um backup." yes="Continuar" danger onClose={() => setWipe(0)} onYes={() => setTimeout(() => setWipe(2), 50)} />}
      {wipe === 2 && <Confirm title="Tem certeza absoluta?" text="Última confirmação. Tudo será apagado agora." yes="Apagar definitivamente" danger onClose={() => setWipe(0)} onYes={async () => { await eraseEverything(); onExit(); }} />}
    </Drawer>
  );
}

function InstallCard() {
  const [, force] = useState(0);
  useEffect(() => onInstallChange(() => force((n) => n + 1)), []);
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return (
    <div className="card">
      <b>Instalar como aplicativo</b>
      {isInstalled() ? <div className="small pos" style={{ marginTop: 4 }}>Já está instalado neste aparelho.</div>
        : canInstall() ? <><div className="small muted" style={{ margin: '4px 0 8px' }}>Ícone na tela inicial, abre em tela cheia e funciona sem internet.</div><button className="btn primary" onClick={() => void promptInstall()}>Instalar</button></>
          : pwaSupported() ? <div className="small muted" style={{ marginTop: 4, lineHeight: 1.6 }}>{ios ? 'No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".' : 'No menu do navegador, escolha "Instalar app" ou "Adicionar à tela inicial".'}</div>
            : <div className="small muted" style={{ marginTop: 4, lineHeight: 1.6 }}>A instalação funciona quando o jogo é aberto pelo endereço do site (veja o README). Neste modo, use o link ou o arquivo como está.</div>}
    </div>
  );
}
