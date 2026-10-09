import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json; charset=utf-8' };
const port = Number(process.env.PORT) || 5173;

createServer(async (req, res) => {
  const path = new URL(req.url, 'http://x').pathname;
  const file = join('docs', normalize(path === '/' ? '/index.html' : path));
  try {
    res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`http://localhost:${port}`));
