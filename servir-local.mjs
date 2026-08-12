// Servidor estático LOCAL do build (dist/) — uso: node servir-local.mjs [porta]
// Existe porque o `serve`/`vite preview` daqui têm pegadinhas (Console Ninja trava o
// preview; o serve ignora headers do serve.json). Regras: SPA fallback pro index.html
// e Cache-Control: no-cache em TUDO — em iteração local, cache de HTML velho gera
// tela de erro de chunk fantasma. Produção (Vercel) tem os headers corretos própria.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const DIST = join(import.meta.dirname, 'dist');
const PORTA = Number(process.argv[2] || 4600);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.webm': 'video/webm', '.mp4': 'video/mp4',
};

createServer(async (req, res) => {
  const caminho = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([\\/.])+/, '');
  let arquivo = join(DIST, caminho);
  let corpo;
  try { corpo = await readFile(arquivo); }
  catch { arquivo = join(DIST, 'index.html'); corpo = await readFile(arquivo); }
  res.writeHead(200, {
    'Content-Type': MIME[extname(arquivo)] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  res.end(corpo);
}).listen(PORTA, () => console.log(`[ok] build servido em http://localhost:${PORTA} (no-cache)`));
