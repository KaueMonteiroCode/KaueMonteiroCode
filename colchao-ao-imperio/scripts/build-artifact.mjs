/**
 * Gera uma página única (JS e CSS embutidos) para publicar o jogo como página web hospedada.
 * Uso: npm run build && node scripts/build-artifact.mjs [saida.html]
 */
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const js = html.match(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"/)?.[1];
const css = html.match(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)"/)?.[1];
if (!js || !css) throw new Error('Não achei os arquivos do build em dist/index.html');
const jsCode = fs.readFileSync(path.join(dist, js), 'utf8').replace(/<\/script/gi, '<\\/script');
const cssCode = fs.readFileSync(path.join(dist, css), 'utf8').replace(/<\/style/gi, '<\\/style');
const out = `<title>Do Colchão ao Império</title>
<meta name="theme-color" content="#14121c">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap">
<style>${cssCode}
html,body{height:100%;background:#14121c;color-scheme:dark}
</style>
<div id="root"></div>
<script type="module">${jsCode}</script>
`;
const target = process.argv[2] ?? path.resolve('dist-artifact/colchao-ao-imperio.html');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, out);
console.log('ok', target, (out.length / 1024).toFixed(0) + ' KB');
