import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, type AppConfig } from './config.js';
import { redactSecrets } from './types.js';
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
  const url = new URL(req.url || '/', 'http://x'); // NOSONAR (typescript:S5332) -- dummy base for parsing relative URL, never fetched
  if (url.pathname.startsWith('/api/')) return false;
  const p = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = path.join(publicDir, path.normalize(p).replace(/^\/+/, ''));
  if (!file.startsWith(publicDir)) { res.writeHead(403); res.end('denied'); return true; }
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': p.endsWith('.html') ? 'no-store' : 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    fs.createReadStream(file).pipe(res);
    return true;
  }
  // Missing assets must be 404s, not HTML served with a successful status.
  if (path.extname(p) || p.startsWith('/build/') || p.startsWith('/assets/')) {
    res.writeHead(404); res.end('asset not found'); return true;
  }
  // SPA fallback for navigation routes only.
  const idx = path.join(publicDir, 'index.html');
  res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' });
  fs.createReadStream(idx).pipe(res);
  return true;
}

function selectAgent(cfg: ReturnType<typeof loadConfig>): MockAgent | OpenCodeAdapter | CodexAdapter {
  if (cfg.opencodeBaseUrl) return new OpenCodeAdapter(cfg.opencodeBaseUrl);
  if (cfg.codexEnabled) return new CodexAdapter();
  return new MockAgent();
}

export function createServer(options: { config?: AppConfig; publicDir?: string } = {}): http.Server {
  const cfg = options.config ?? loadConfig();
  const publicDir = options.publicDir ?? fileURLToPath(new URL('../public/', import.meta.url));
  for (const asset of ['index.html', 'build/app.js', 'build/app.css']) {
    if (!fs.existsSync(path.join(publicDir, asset))) throw new Error(`WebUI asset missing: ${asset}. Run npm run build before starting Hasswright.`);
  }
  const store = new Store(cfg.dataDir);
  const ha = new HACore(cfg.haBaseUrl, cfg.haToken);
  const supervisor = new Supervisor(cfg.supervisorBaseUrl, cfg.supervisorToken);
  const ctx = new ContextEngine(ha);
  const gateway = new ToolGateway({ mode: cfg.mode, ha, supervisor, store, ctx, configDir: cfg.dataDir });
  const approvals = new Approvals(store);
  const agent = selectAgent(cfg);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://x'); // NOSONAR (typescript:S5332) -- dummy base for parsing, no network call
      // Only Supervisor Ingress may reach a configured add-on. Do not trust a
      // client-supplied forwarding header as proof of authentication.
      if (cfg.supervisorToken && url.pathname !== '/api/health' && !isIngressPeer(req.socket.remoteAddress)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Open Hasswright through Home Assistant Ingress' }));
        return;
      }
      const handled = await handleApi(req, res, url, {
        store, gateway, ctx, agent, approvals, mode: cfg.mode,
        supervisor, supervisorConfigured: supervisor.configured, demoFixture: ha.fixture,
      });
      if (handled) return;
      if (servePublic(req, res, publicDir)) return;
      res.writeHead(404); res.end('not found');
    } catch (e) {
      // Intentionally generic response; log a sanitized message for diagnostics.
      console.error(`[hasswright] request failed: ${redactSecrets(e instanceof Error ? e.message : 'unknown')}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'internal' }));
    }
  });
  return server;
}

export function isIngressPeer(address: string | undefined): boolean {
  return address === '172.30.32.2' || address === '::ffff:172.30.32.2';
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
