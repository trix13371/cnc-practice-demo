const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid PORT');
const files = {
 '/course-route-ui.js':['course-route-ui.js','text/javascript; charset=utf-8'],
 '/app.css':['app.css','text/css; charset=utf-8'],
 '/course-view-model.js':['course-view-model.js','text/javascript; charset=utf-8'],
 '/replay-cache-model.js':['replay-cache-model.js','text/javascript; charset=utf-8'],
 '/diagnostic-course-model.js':['diagnostic-course-model.js','text/javascript; charset=utf-8'],
 '/diagnostic-course-ui.js':['diagnostic-course-ui.js','text/javascript; charset=utf-8'],
 '/milling-course-model.js':['milling-course-model.js','text/javascript; charset=utf-8'],
 '/milling-course-ui.js':['milling-course-ui.js','text/javascript; charset=utf-8'],
 '/operation-course-model.js':['operation-course-model.js','text/javascript; charset=utf-8'],
 '/operation-course-ui.js':['operation-course-ui.js','text/javascript; charset=utf-8'],
  '/shaft-project-model.js':['shaft-project-model.js','text/javascript; charset=utf-8'],
  '/shaft-project-ui.js':['shaft-project-ui.js','text/javascript; charset=utf-8'],
  '/program-setup-model.js':['program-setup-model.js','text/javascript; charset=utf-8'],
  '/program-setup-ui.js':['program-setup-ui.js','text/javascript; charset=utf-8'],
  '/first-process-model.js':['first-process-model.js','text/javascript; charset=utf-8'],
  '/first-process-ui.js':['first-process-ui.js','text/javascript; charset=utf-8'],
  '/drawing-session-model.js':['drawing-session-model.js','text/javascript; charset=utf-8'],
  '/drawing-session-ui.js':['drawing-session-ui.js','text/javascript; charset=utf-8'],
  '/start-session-model.js':['start-session-model.js','text/javascript; charset=utf-8'],
  '/start-session-ui.js':['start-session-ui.js','text/javascript; charset=utf-8'],
  '/normative-model.js':['normative-model.js','text/javascript; charset=utf-8'],
  '/normative-ui.js':['normative-ui.js','text/javascript; charset=utf-8'],
  '/radial-ops-model.js':['radial-ops-model.js','text/javascript; charset=utf-8'],
  '/stock-shape-model.js': ['stock-shape-model.js', 'text/javascript; charset=utf-8'],
  '/real-machine-model.js': ['real-machine-model.js', 'text/javascript; charset=utf-8'],
  '/real-machine-ui.js': ['real-machine-ui.js', 'text/javascript; charset=utf-8'],
  '/real-machine.css': ['real-machine.css', 'text/css; charset=utf-8'],
  '/sandbox-model.js': ['sandbox-model.js', 'text/javascript; charset=utf-8'],
  '/sandbox-ui.js': ['sandbox-ui.js', 'text/javascript; charset=utf-8'],
  '/sandbox.css': ['sandbox.css', 'text/css; charset=utf-8'],
  '/model-spec-model.js': ['model-spec-model.js', 'text/javascript; charset=utf-8'],
  '/model-spec-ui.js': ['model-spec-ui.js', 'text/javascript; charset=utf-8'],
  '/discovery-practice-model.js': ['discovery-practice-model.js', 'text/javascript; charset=utf-8'],
  '/discovery-practice-ui.js': ['discovery-practice-ui.js', 'text/javascript; charset=utf-8'],
  '/typography.css': ['typography.css', 'text/css; charset=utf-8'],
  '/assets/fonts/golos-text-variable.ttf': ['assets/fonts/golos-text-variable.ttf', 'font/ttf'],
  '/light-theme.css': ['light-theme.css', 'text/css; charset=utf-8'],
  '/assets/lathe-hero.png': ['assets/lathe-hero.png', 'image/png'],
  '/pilot-model.js': ['pilot-model.js', 'text/javascript; charset=utf-8'],
  '/pilot-ui.js': ['pilot-ui.js', 'text/javascript; charset=utf-8'],
  '/progress-config.js': ['progress-config.js', 'text/javascript; charset=utf-8'],
  '/progress-store.js': ['progress-store.js', 'text/javascript; charset=utf-8'],
  '/progress-bootstrap.js': ['progress-bootstrap.js', 'text/javascript; charset=utf-8'],
  '/progress-model.js': ['progress-model.js', 'text/javascript; charset=utf-8'],
  '/progress-ui.js': ['progress-ui.js', 'text/javascript; charset=utf-8'],
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/task-guides.js': ['task-guides.js', 'text/javascript; charset=utf-8'],
  '/learning-path-model.js': ['learning-path-model.js', 'text/javascript; charset=utf-8'],
  '/learning-path-ui.js': ['learning-path-ui.js', 'text/javascript; charset=utf-8'],
  '/basic-session-model.js': ['basic-session-model.js', 'text/javascript; charset=utf-8'],
  '/home-ui.js': ['home-ui.js', 'text/javascript; charset=utf-8'],
  '/workshop-theme.css': ['workshop-theme.css', 'text/css; charset=utf-8'],
  '/workshop.js': ['workshop.js', 'text/javascript; charset=utf-8'],
  '/course-model.js': ['course-model.js', 'text/javascript; charset=utf-8'],
  '/gcode-model.js': ['gcode-model.js', 'text/javascript; charset=utf-8'],
  '/gcode-learning-model.js': ['gcode-learning-model.js', 'text/javascript; charset=utf-8'],
  '/gcode-ui.js': ['gcode-ui.js', 'text/javascript; charset=utf-8'],
  '/machine-model.js': ['machine-model.js', 'text/javascript; charset=utf-8'],
  '/machine-graphics.js': ['machine-graphics.js', 'text/javascript; charset=utf-8'],
  '/machine-ui.js': ['machine-ui.js', 'text/javascript; charset=utf-8'],
  '/course-discovery.js': ['course-discovery.js', 'text/javascript; charset=utf-8'],
  '/course-ui.js': ['course-ui.js', 'text/javascript; charset=utf-8'],
  '/skills-model.js': ['skills-model.js', 'text/javascript; charset=utf-8'],
  '/skills-ui.js': ['skills-ui.js', 'text/javascript; charset=utf-8'],
  '/library-model.js': ['library-model.js', 'text/javascript; charset=utf-8'],
  '/library-content-model.js': ['library-content-model.js', 'text/javascript; charset=utf-8'],
  '/library-ui.js': ['library-ui.js', 'text/javascript; charset=utf-8'],
  '/training-math.js': ['training-math.js', 'text/javascript; charset=utf-8'],
  '/training-model.js': ['training-model.js', 'text/javascript; charset=utf-8'],
  '/cycle-ui.js': ['cycle-ui.js', 'text/javascript; charset=utf-8'],
  '/training-ui.js': ['training-ui.js', 'text/javascript; charset=utf-8'],
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
  '/demo/cnc-handbook.html': ['demo/cnc-handbook.html', 'text/html; charset=utf-8'],
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
    ? `Порт ${port} занят. Остановите другой локальный сервер и повторите запуск.`
    : 'Не удалось запустить локальный сервер.');
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log('Local: http://127.0.0.1:' + port));
