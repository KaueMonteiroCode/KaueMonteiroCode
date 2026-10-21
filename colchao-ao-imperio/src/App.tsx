import { useEffect, useState } from 'react';
import { boot, startNewGame, useMaybeSave } from './state/store';
import { TitleScreen } from './ui/TitleScreen';
import { Game } from './ui/Game';

export function App() {
  const save = useMaybeSave();
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<'title' | 'game'>('title');
  useEffect(() => { boot().then(() => setReady(true)); }, []);
  useEffect(() => { if (ready && !save) setScreen('title'); }, [ready, save]);
  if (!ready) return <div className="title-screen"><div className="pix gold">Carregando…</div></div>;
  if (screen === 'title' || !save) {
    return <TitleScreen save={save} onNew={() => { startNewGame(); setScreen('game'); }} onContinue={() => setScreen('game')} />;
  }
  return <Game save={save} onExit={() => setScreen('title')} />;
}
