import type { Progress } from '../game/progress';
import { Coins, Modal } from './common';

/** Explica de onde vêm as moedas e por que o saldo pode ficar negativo. */
export function CoinsInfo({ progress, onClose }: { progress: Progress; onClose: () => void }) {
  const neg = progress.coins < 0;
  return (
    <Modal title="Suas moedas" onClose={onClose}>
      {neg && (
        <div className="hint warn" style={{ marginBottom: 10 }}>
          <b>Saldo negativo:</b> você gastou moedas na loja e depois um lançamento que tinha gerado moedas foi corrigido ou excluído.
          As moedas são sempre recalculadas a partir do seu histórico real, então elas "voltaram". Nada foi perdido na decoração:
          assim que você economizar de novo (ou vender algum móvel), o saldo volta a ficar positivo e a loja libera.
        </div>
      )}
      <table className="tbl">
        <thead><tr><th>De onde veio</th><th className="r">Moedas</th></tr></thead>
        <tbody>
          {progress.breakdown.map((b) => <tr key={b.label}><td>{b.label}</td><td className="r">{b.coins}</td></tr>)}
          <tr><td>Compras e vendas na loja</td><td className="r">{progress.coinsSpentNet}</td></tr>
          <tr><td><b>Saldo</b></td><td className="r"><b className={neg ? 'neg' : 'gold'}><Coins n={progress.coins} /></b></td></tr>
        </tbody>
      </table>
      <div className="small muted" style={{ marginTop: 10, lineHeight: 1.6 }}>
        Moedas vêm do <b>crescimento real do seu patrimônio</b> (economizar), da <b>redução do total das suas dívidas</b>, de dias com registros, conquistas e missões.
        Transferir entre contas, pegar empréstimo, trocar uma dívida por outra ou ajustar saldo para cima não rende moedas.
        Gastar dinheiro real depois não tira moedas já ganhas, mas apagar um lançamento falso tira.
      </div>
    </Modal>
  );
}
