// 의존성 없는 로컬 정적 서버. `npm start` 또는 PLAY.bat 으로 실행한다.
// 같은 Wi-Fi 의 폰에서도 접속할 수 있도록 LAN 주소를 함께 출력한다.
//   --open   서버가 뜨면 기본 브라우저로 게임을 연다

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const firstPort = Number(process.env.PORT) || 5173;
const open = process.argv.includes('--open');
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.md': 'text/markdown; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(root, rel);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end('Forbidden'); return; }   // 루트 밖 접근 차단
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
});

let port = firstPort;
server.on('error', (err) => {
  // 포트가 이미 쓰이고 있으면 다음 포트로 넘어간다
  if (err.code === 'EADDRINUSE' && port < firstPort + 20) { port++; server.listen(port, '0.0.0.0'); return; }
  console.error('Could not start the server:', err.message);
  process.exit(1);
});
server.on('listening', () => {
  const url = `http://localhost:${port}`;
  console.log(`PIXEL BREAKER  ->  ${url}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const n of list || []) if (n.family === 'IPv4' && !n.internal) console.log(`on your phone   ->  http://${n.address}:${port}`);
  }
  console.log('Keep this window open while playing. Press Ctrl+C to stop.');
  if (open) {
    const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
    exec(cmd, () => {});
  }
});
server.listen(port, '0.0.0.0');
