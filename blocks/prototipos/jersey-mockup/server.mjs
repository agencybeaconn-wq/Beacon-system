import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8080;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.css': 'text/css',
  '.js': 'application/javascript',
};

http.createServer((req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const file = path.join(dir, url);
  if (!file.startsWith(dir) || !fs.existsSync(file)) {
    res.statusCode = 404;
    return res.end('not found');
  }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
