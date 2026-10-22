import { Component, useState, type ReactNode } from 'react';
import { eraseEverything, getState, hasState, undoRestore } from '../state/store';

/** Tela de recuperação: se algo quebrar, os dados nunca ficam presos atrás de uma tela branca. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('Erro na interface:', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return <Recovery error={this.state.error} onRetry={() => this.setState({ error: null })} />;
  }
}

function Recovery({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [msg, setMsg] = useState('');
  const [wipe, setWipe] = useState(false);
  const data = (() => { try { return hasState() ? JSON.stringify(getState()) : localStorage.getItem('colchao-ao-imperio:save') ?? ''; } catch { return ''; } })();
  return (
    <div className="title-screen">
      <div className="modal" style={{ width: 'min(560px, 100%)' }}>
        <h3>Ops! Algo deu errado</h3>
        <p className="small" style={{ lineHeight: 1.6 }}>Seus dados continuam guardados. Antes de qualquer coisa, copie-os para um lugar seguro.</p>
        <div className="tiny muted" style={{ marginBottom: 8 }}>Detalhe técnico: {error.message}</div>
        <textarea readOnly rows={4} value={data} onFocus={(e) => e.currentTarget.select()} style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10 }} />
        <div className="row wrap" style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={async () => { try { await navigator.clipboard.writeText(data); setMsg('Dados copiados.'); } catch { setMsg('Selecione o texto acima e copie manualmente.'); } }}>Copiar meus dados</button>
          <button className="btn" onClick={onRetry}>Tentar de novo</button>
          <button className="btn" onClick={async () => { setMsg((await undoRestore()) ? 'Restauração desfeita.' : 'Não há restauração para desfazer.'); onRetry(); }}>Desfazer última restauração</button>
          <button className="btn danger" onClick={() => setWipe(true)}>Apagar e recomeçar</button>
        </div>
        {msg && <div className="small gold" style={{ marginTop: 8 }}>{msg}</div>}
        {wipe && (
          <div className="hint warn" style={{ marginTop: 10 }}>
            Isso apaga tudo deste navegador. Copiou seus dados?{' '}
            <button className="btn sm danger" onClick={async () => { await eraseEverything(); location.reload(); }}>Sim, apagar</button>
          </div>
        )}
      </div>
    </div>
  );
}
