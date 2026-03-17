import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PtyManager } from './pty-manager';
import { WsServer } from './ws-server';
import { registerIpcHandlers } from './ipc-handlers';
import { startHookWatcher } from './hook-watcher';
import { IPC } from '../shared/ipc-channels';

const RENDERER_DIR = path.resolve(process.env.AIRPORT_RENDERER_DIR || path.join(__dirname, 'renderer'));
const SHUTDOWN_TOKEN = crypto.randomBytes(32).toString('hex');

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  let filePath = path.resolve(RENDERER_DIR, '.' + url.pathname);

  // Prevent path traversal — resolved path must stay within RENDERER_DIR
  if (!filePath.startsWith(RENDERER_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Try the exact path first, then fall back to index.html (SPA)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(RENDERER_DIR, 'index.html');
  }

  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not Found');
  }
}

const httpServer = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/shutdown') {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${SHUTDOWN_TOKEN}`) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    res.writeHead(200);
    res.end('OK');
    shutdown();
    return;
  }
  serveStatic(req, res);
});
const wsServer = new WsServer();
const ptyManager = new PtyManager();

registerIpcHandlers(ptyManager, wsServer);
const stopHookWatcher = startHookWatcher(ptyManager, wsServer);

httpServer.listen(0, '127.0.0.1', async () => {
  await wsServer.start(httpServer);
  const addr = httpServer.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  process.stdout.write(`AIRPORT_PORT=${port}\n`);
  process.stdout.write(`AIRPORT_TOKEN=${SHUTDOWN_TOKEN}\n`);
});

function shutdown() {
  wsServer.broadcast(IPC.STATE_REQUEST_SAVE);
  setTimeout(() => {
    stopHookWatcher();
    ptyManager.closeAll();
    wsServer.close();
    httpServer.close();
    process.exit(0);
  }, 500);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
