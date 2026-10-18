import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.js';
import { Store } from './storage.js';
import { HACore } from './ha/core.js';
import { Supervisor } from './ha/supervisor.js';
import { ContextEngine } from './context/engine.js';
import { ToolGateway } from './tools/gateway.js';
import { Approvals } from './policy/approvals.js';
import { MockAgent } from './agent/types.js';
import { OpenCodeAdapter } from './agent/opencode.js';
import { CodexAdapter } from './agent/codex.js';
import { handleApi } from './routes/api.js';

const MIME: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png',
};

function servePublic(req: http.IncomingMessage, res: http.ServerResponse, publicDir: string): boolean {
  const url = new URL(req.url || '/', 'http://x');
  if (url.pathname.startsWith('/api/')) return false;
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.join(publicDir, path.normalize(p).replace(/^\/+/, ''));
  if (!file.startsWith(publicDir)) { res.writeHead(403); res.end('denied'); return true; }
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
    return true;
  }
  // SPA fallback
  const idx = path.join(publicDir, 'index.html');
  res.writeHead(200, { 'Content-Type': 'text/html' });
  fs.createReadStream(idx).pipe(res);
  return true;
}

export function createServer(): http.Server {
  const cfg = loadConfig();
  const store = new Store(cfg.dataDir);
  const ha = new HACore(cfg.haBaseUrl, cfg.haToken);
  const supervisor = new Supervisor(cfg.supervisorBaseUrl, cfg.supervisorToken);
  const ctx = new ContextEngine(ha);
  const gateway = new ToolGateway({ mode: cfg.mode, ha, supervisor, store, ctx, configDir: cfg.dataDir });
  const approvals = new Approvals(store);
  const agent = cfg.opencodeBaseUrl ? new OpenCodeAdapter(cfg.opencodeBaseUrl)
    : cfg.codexEnabled ? new CodexAdapter() : new MockAgent();

  const publicDir = path.join(process.cwd(), 'public').includes('dist')
    ? path.join(process.cwd(), '..', 'public')
    : path.join(process.cwd(), 'public');
  const resolvedPublic = fs.existsSync(path.join(process.cwd(), 'public')) ? path.join(process.cwd(), 'public')
    : fs.existsSync('/app/public') ? '/app/public' : publicDir;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://x');
      // Ingress auth: Home Assistant ingress validates session; also accept HA bearer for direct API.
      const handled = await handleApi(req, res, url, {
        store, gateway, ctx, agent, approvals, mode: cfg.mode,
        supervisorConfigured: supervisor.configured, demoFixture: ha.fixture,
      });
      if (handled) return;
      if (servePublic(req, res, resolvedPublic)) return;
      res.writeHead(404); res.end('not found');
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal' }));
    }
  });
  return server;
}

const isMain = process.argv[1]?.endsWith('server.js');
if (isMain) {
  const cfg = loadConfig();
  const server = createServer();
  server.listen(cfg.port, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`[hasswright] listening on :${cfg.port} mode=${cfg.mode} demo=${cfg.demo}`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
