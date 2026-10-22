import { useState } from 'react';
import { saveFile } from '../core/download';
import { Modal } from './common';

/** Mostra a foto do quarto com opção de salvar (no celular dá também para segurar a imagem). */
export function PhotoModal({ canvas, onClose }: { canvas: HTMLCanvasElement; onClose: () => void }) {
  const [msg, setMsg] = useState('');
  const url = canvas.toDataURL('image/png');
  return (
    <Modal title="Foto do quarto" onClose={onClose} wide>
      <img src={url} alt="Foto do seu ambiente no jogo" style={{ width: '100%', imageRendering: 'pixelated', borderRadius: 6, boxShadow: '0 0 0 2px #0e0b14' }} />
      <div className="small muted" style={{ marginTop: 6 }}>No celular, você também pode tocar e segurar a imagem para salvar ou compartilhar.</div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
        {msg && <span className="small gold grow">{msg}</span>}
        <button className="btn primary" onClick={() => canvas.toBlob(async (b) => {
          if (!b) return;
          const r = await saveFile(`meu-quarto-${new Date().toISOString().slice(0, 10)}.png`, b, 'image/png');
          setMsg(r === 'saved' ? 'Imagem salva.' : r === 'declined' ? 'Cancelado.' : 'Não deu para salvar aqui; segure a imagem para salvar.');
        }, 'image/png')}>Salvar imagem</button>
      </div>
    </Modal>
  );
}
