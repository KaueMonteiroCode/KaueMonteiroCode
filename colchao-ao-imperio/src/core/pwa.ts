/**
 * Instalação como aplicativo (PWA). Só funciona quando o jogo é aberto por um endereço web
 * próprio (ex.: GitHub Pages): no arquivo local e dentro da página publicada no Claude,
 * o navegador não permite service worker, então nada é registrado.
 */
type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: BIPEvent | null = null;
const listeners = new Set<() => void>();

export function pwaSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol) && window.top === window;
}

export function initPWA() {
  if (!pwaSupported()) return;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BIPEvent; listeners.forEach((l) => l()); });
  window.addEventListener('appinstalled', () => { deferred = null; listeners.forEach((l) => l()); });
  if (!import.meta.env.DEV) navigator.serviceWorker.register('./sw.js').catch(() => { /* sem offline, o jogo funciona igual */ });
}

export const canInstall = () => !!deferred;
export const isInstalled = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
export function onInstallChange(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; }
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const r = await deferred.userChoice;
  deferred = null;
  listeners.forEach((l) => l());
  return r.outcome === 'accepted';
}
