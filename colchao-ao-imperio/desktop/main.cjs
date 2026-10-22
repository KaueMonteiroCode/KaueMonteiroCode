// Janela do jogo para Windows (Electron). Tudo continua local e offline:
// o jogo é o mesmo arquivo HTML, e o save fica na pasta de dados do app.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

app.setName('Colchao ao Imperio');
if (!app.requestSingleInstanceLock()) app.quit();

function open() {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 360, minHeight: 560,
    backgroundColor: '#0e0b14', title: 'Do Colchão ao Império',
    icon: path.join(__dirname, 'icon.png'), autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'index.html'));
  // links externos abrem no navegador, nunca dentro do jogo
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.webContents.on('before-input-event', (_e, i) => { if (i.type === 'keyDown' && i.key === 'F11') win.setFullScreen(!win.isFullScreen()); });
}

app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
app.whenReady().then(open);
app.on('window-all-closed', () => app.quit());
