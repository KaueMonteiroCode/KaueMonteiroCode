// Monta o app de Windows: baixa o Electron oficial (win32-x64), coloca o jogo
// (arquivo único gerado por build:file) dentro e compacta em dist-exe/*.zip.
// Uso: npm run build:exe   (precisa de internet só para baixar o Electron)
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const VER = process.env.ELECTRON_VERSION ?? '33.2.1';
const root = path.resolve('.');
const html = path.join(root, 'dist-artifact/Colchao-ao-Imperio.html');
if (!fs.existsSync(html)) throw new Error('Rode antes: npm run build:file');
const cache = path.join(root, '.cache');
const zipName = `electron-v${VER}-win32-x64.zip`;
const zipPath = path.join(cache, zipName);
fs.mkdirSync(cache, { recursive: true });
if (!fs.existsSync(zipPath)) {
  const url = `https://github.com/electron/electron/releases/download/v${VER}/${zipName}`;
  console.log('baixando', url);
  // curl respeita proxy e retoma; é padrão no Windows 10+, macOS e Linux
  execFileSync('curl', ['-fL', '--retry', '3', '-o', zipPath + '.part', url], { stdio: 'inherit' });
  fs.renameSync(zipPath + '.part', zipPath);
}
const out = path.join(root, 'dist-exe');
const dir = path.join(out, 'Colchao-ao-Imperio');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
execFileSync('unzip', ['-q', zipPath, '-d', dir]);
fs.renameSync(path.join(dir, 'electron.exe'), path.join(dir, 'Colchao ao Imperio.exe'));
fs.rmSync(path.join(dir, 'resources', 'default_app.asar'), { force: true });
const app = path.join(dir, 'resources', 'app');
fs.mkdirSync(app, { recursive: true });
fs.copyFileSync(path.join(root, 'desktop/main.cjs'), path.join(app, 'main.cjs'));
fs.copyFileSync(html, path.join(app, 'index.html'));
fs.copyFileSync(path.join(root, 'public/icon-512.png'), path.join(app, 'icon.png'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
fs.writeFileSync(path.join(app, 'package.json'), JSON.stringify({ name: 'colchao-ao-imperio', productName: 'Colchao ao Imperio', version: pkg.version, main: 'main.cjs' }, null, 2));
fs.writeFileSync(path.join(dir, 'LEIA-ME.txt'), [
  'DO COLCHÃO AO IMPÉRIO',
  '',
  '1. Extraia esta pasta inteira (botão direito no .zip > Extrair tudo).',
  '2. Abra "Colchao ao Imperio.exe".',
  '3. Se o Windows mostrar "O Windows protegeu o computador", clique em',
  '   "Mais informações" > "Executar assim mesmo" (o app não tem assinatura paga).',
  '',
  'Tudo fica salvo no seu computador. Nada é enviado para a internet.',
  'F11 alterna tela cheia. Faça backups em Ajustes > Backup.',
].join('\r\n'));
const final = path.join(out, 'Colchao-ao-Imperio-Windows.zip');
execFileSync('zip', ['-qr9', final, 'Colchao-ao-Imperio'], { cwd: out });
console.log('ok', final, (fs.statSync(final).size / 1e6).toFixed(1) + ' MB');
