const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/workshop.js': ['workshop.js', 'text/javascript; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/model.js': ['model.js', 'text/javascript; charset=utf-8'],
  '/lab-model.js': ['lab-model.js', 'text/javascript; charset=utf-8'],
  '/lab-ui.js': ['lab-ui.js', 'text/javascript; charset=utf-8'],
  '/viewer3d.js': ['viewer3d.js', 'text/javascript; charset=utf-8'],
  '/process-model.js': ['process-model.js', 'text/javascript; charset=utf-8'],
  '/route-exam-model.js': ['route-exam-model.js', 'text/javascript; charset=utf-8'],
  '/lab-session.js': ['lab-session.js', 'text/javascript; charset=utf-8'],
  '/route-exam-ui.js': ['route-exam-ui.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/demo/cnc-demo.html': ['demo/cnc-demo.html', 'text/html; charset=utf-8'],
  '/docs/preview.jpg': ['docs/preview.jpg', 'image/jpeg']
};
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('Method not allowed');
    return;
  }
  const file = files[new URL(req.url, 'http://localhost').pathname];
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(path.join(root, file[0]), (error, bytes) => {
    if (error) { res.writeHead(500); res.end('Unable to read file'); return; }
    res.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  });
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? 'Порт 4173 занят. Остановите другой локальный сервер и повторите запуск.'
    : 'Не удалось запустить локальный сервер.');
  process.exitCode = 1;
});
server.listen(4173, '127.0.0.1', () => console.log('Local: http://127.0.0.1:4173'));
