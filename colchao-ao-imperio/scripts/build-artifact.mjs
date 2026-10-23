/**
 * Gera uma página única (JS e CSS embutidos) para publicar o jogo como página web hospedada.
 * Uso: npm run build && node scripts/build-artifact.mjs [saida.html]
 */
import fs from 'node:fs';
import path from 'node:path';

const office = process.argv.includes('--office');
const dist = path.resolve(office ? 'dist-office' : 'dist');
const html = fs.readFileSync(path.join(dist, office ? 'escritorio.html' : 'index.html'), 'utf8');
const js = html.match(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"/)?.[1];
const css = html.match(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)"/)?.[1];
if (!js || !css) throw new Error('Não achei os arquivos do build em dist/index.html');
const jsCode = fs.readFileSync(path.join(dist, js), 'utf8').replace(/<\/script/gi, '<\\/script');
const cssCode = fs.readFileSync(path.join(dist, css), 'utf8').replace(/<\/style/gi, '<\\/style');
let out = `<title>${office ? 'Escritório dos Robôs' : 'Do Colchão ao Império'}</title>
<meta name="theme-color" content="#14121c">${office ? '\n<link rel="icon" href="favicon.svg" type="image/svg+xml">' : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap">
<style>${cssCode}
html,body{height:100%;background:#14121c;color-scheme:dark}
</style>
<div id="root"></div>
<script type="module">${jsCode}</script>
`;
const standalone = process.argv.includes('--standalone');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const target = args[0] ?? path.resolve(office ? (standalone ? 'office-server/public/escritorio.html' : 'dist-artifact/escritorio.html') : standalone ? 'dist-artifact/Colchao-ao-Imperio.html' : 'dist-artifact/colchao-ao-imperio.html');
// --standalone: documento HTML completo, para abrir com dois cliques direto do disco
if (standalone) out = `<!doctype html>\n<html lang="pt-BR">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${out.replace('<div id="root"></div>', '</head>\n<body>\n<div id="root"></div>')}</body>\n</html>\n`;
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, out);
console.log('ok', target, (out.length / 1024).toFixed(0) + ' KB');
