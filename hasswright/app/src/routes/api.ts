import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Store } from '../storage.js';
import type { ToolGateway } from '../tools/gateway.js';
import type { ContextEngine } from '../context/engine.js';
import type { AgentAdapter } from '../agent/types.js';
import type { Supervisor } from '../ha/supervisor.js';
import { Approvals } from '../policy/approvals.js';
import { classify } from '../policy/risk.js';
import { TOOL_DEFINITIONS } from '../tools/definitions.js';
import { redactSecrets } from '../types.js';
import { ADDON_REPOSITORY, ADDON_SLUG, ADDON_VERSION } from '../version.js';

export interface RouteCtx {
  store: Store; gateway: ToolGateway; ctx: ContextEngine;
  agent: AgentAdapter; approvals: Approvals; mode: string;
  supervisor: Supervisor; supervisorConfigured: boolean; demoFixture: boolean;
}

export async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

export function send(res: ServerResponse, code: number, body: unknown): void {
  const text = JSON.stringify(redactSecrets(body));
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(text) });
  res.end(text);
}

const SESSION_RE = /^\/api\/sessions\/([^/]+)(\/messages)?$/;

export async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL, c: RouteCtx): Promise<boolean> {
  if (!url.pathname.startsWith('/api/')) return false;
  const method = req.method || 'GET';

  if (url.pathname === '/api/health') return (send(res, 200, { ok: true, mode: c.mode, agent: c.agent.name, ts: Date.now(), version: ADDON_VERSION }), true);
  if (url.pathname === '/api/version' && method === 'GET') return (await handleVersion(req, res, c), true);
  if (await handleSessions(req, res, url, c, method)) return true;
  if (await handleContext(req, res, url, c, method)) return true;
  if (await handleToolExec(req, res, url, c, method)) return true;
  if (await handleApprovals(req, res, url, c, method)) return true;
  if (handleMaintenance(res, url, method)) return true;
  if (url.pathname === '/api/audit' && method === 'GET') return (send(res, 200, { audit: c.store.listAudit(100) }), true);

  return false;
}

async function handleSessions(req: IncomingMessage, res: ServerResponse, url: URL, c: RouteCtx, method: string): Promise<boolean> {
  if (url.pathname === '/api/sessions' && method === 'GET') return (send(res, 200, { sessions: c.store.listSessions() }), true);
  if (url.pathname === '/api/sessions' && method === 'POST') {
    const s = newSession();
    c.store.putSession(s as never);
    return (send(res, 201, { session: s }), true);
  }
  const sessMatch = SESSION_RE.exec(url.pathname);
  if (!sessMatch) return false;
  if (method === 'GET' && !sessMatch[2]) return sendSession(res, c, sessMatch[1]);
  if (method === 'POST' && sessMatch[2]) return postMessage(req, res, c, sessMatch[1]);
  return false;
}

function newSession(): { id: string; title: string; createdAt: number; updatedAt: number; messages: Array<{ role: 'user' | 'assistant'; content: string; ts: number }> } {
  const now = Date.now();
  return { id: `local-${randomUUID().slice(0, 8)}`, title: 'New conversation', createdAt: now, updatedAt: now, messages: [] };
}

function sendSession(res: ServerResponse, c: RouteCtx, id: string): boolean {
  const s = c.store.getSession(id);
  if (!s) return (send(res, 404, { error: 'not found' }), true);
  return (send(res, 200, { session: s }), true);
}

async function postMessage(req: IncomingMessage, res: ServerResponse, c: RouteCtx, id: string): Promise<boolean> {
  const s = c.store.getSession(id);
  if (!s) return (send(res, 404, { error: 'not found' }), true);
  const body = (await readJson(req)) as { content?: string };
  const content = typeof body.content === 'string' ? body.content.slice(0, 8000) : '';
  if (!content) return (send(res, 400, { error: 'empty' }), true);
  s.messages.push({ role: 'user', content, ts: Date.now() });
  const reply = await runAgent(c, s.id, content);
  s.messages.push({ role: 'assistant', content: reply.slice(0, 12000), ts: Date.now() });
  s.updatedAt = Date.now();
  if (s.messages.length <= 2) s.title = content.slice(0, 60);
  c.store.putSession(s);
  c.store.audit({ ts: Date.now(), actor: 'user', action: 'chat.message', result: 'ok', detail: s.id });
  return (send(res, 200, { reply }), true);
}

async function runAgent(c: RouteCtx, sessionId: string, content: string): Promise<string> {
  const inv = await c.ctx.inventory().catch(() => null);
  const context = JSON.stringify({ counts: inv?.counts, domains: inv?.domains, unavailable: (inv?.unavailable || []).slice(0, 10) });
  try {
    const r = await c.agent.chat(sessionId, content, context, TOOL_DEFINITIONS);
    const lowRisk = r.toolCalls.slice(0, 3).filter((tc) => classify(tc.tool, tc.args) === 'low');
    await Promise.all(lowRisk.map((tc) => c.gateway.exec(tc.tool, tc.args).catch(() => null)));
    return r.text;
  } catch (e) { return `Agent unavailable (${String(e)}). Read-only context is still available in Overview/Explorer.`; }
}

async function handleContext(_req: IncomingMessage, res: ServerResponse, url: URL, c: RouteCtx, method: string): Promise<boolean> {
  if (url.pathname === '/api/overview' && method === 'GET') {
    const inv = await c.ctx.inventory(url.searchParams.get('refresh') === '1').catch((e) => ({ error: String(e) }));
    return (send(res, 200, { overview: { ...(inv as object), demoFixture: c.demoFixture } }), true);
  }
  if (url.pathname === '/api/search' && method === 'GET') {
    return (send(res, 200, { results: c.ctx.search(url.searchParams.get('q') || '') }), true);
  }
  if (url.pathname.startsWith('/api/dependencies/') && method === 'GET') {
    const id = decodeURIComponent(url.pathname.replace('/api/dependencies/', ''));
    return (send(res, 200, c.ctx.dependencies(id)), true);
  }
  return false;
}

async function handleToolExec(req: IncomingMessage, res: ServerResponse, url: URL, c: RouteCtx, method: string): Promise<boolean> {
  if (url.pathname === '/api/tools' && method === 'GET') return (send(res, 200, { tools: TOOL_DEFINITIONS, mode: c.mode }), true);
  if (url.pathname !== '/api/tools/exec' || method !== 'POST') return false;
  const body = (await readJson(req)) as { tool?: string; args?: Record<string, unknown>; approvalId?: string };
  if (!body.tool) return (send(res, 400, { error: 'tool required' }), true);
  // Validate args minimally against definitions
  const known = TOOL_DEFINITIONS.some((t) => t.name === body.tool);
  if (!known) return (send(res, 400, { error: 'unknown tool' }), true);
  try {
    const result = await c.gateway.exec(body.tool, body.args || {}, body.approvalId);
    return (send(res, 200, { result }), true);
  } catch (e) {
    return sendToolError(res, c, e, body.tool, body.args || {});
  }
}

function sendToolError(res: ServerResponse, c: RouteCtx, e: unknown, tool: string, args: Record<string, unknown>): boolean {
  const err = e as Error & { code?: string; risk?: string };
  if (err.code === 'APPROVAL_REQUIRED') {
    const a = c.approvals.request(tool, args, classify(tool, args), previewOf(tool, args));
    return (send(res, 428, { error: 'approval required', approval: a }), true);
  }
  return (send(res, 403, { error: String(err.message || err) }), true);
}

async function handleApprovals(req: IncomingMessage, res: ServerResponse, url: URL, c: RouteCtx, method: string): Promise<boolean> {
  if (url.pathname === '/api/approvals' && method === 'GET') return (send(res, 200, { approvals: c.store.listApprovals() }), true);
  if (url.pathname !== '/api/approvals/decide' || method !== 'POST') return false;
  const body = (await readJson(req)) as { id?: string; approve?: boolean };
  try {
    const a = c.approvals.decide(String(body.id), Boolean(body.approve));
    return (send(res, 200, { approval: a }), true);
  } catch (e) { return (send(res, 400, { error: String(e) }), true); }
}

function handleMaintenance(res: ServerResponse, url: URL, method: string): boolean {
  if (url.pathname !== '/api/maintenance' || method !== 'GET') return false;
  // Lightweight inline status without double HA fetch in demo
  return (send(res, 200, { enabled: process.env.MAINTENANCE_ENABLED === '1', note: 'disabled by default; enable in Settings' }), true);
}

function previewOf(tool: string, args: Record<string, unknown>): string {
  return `${tool} ${JSON.stringify(args).slice(0, 500)}`;
}

async function handleVersion(_req: IncomingMessage, res: ServerResponse, c: RouteCtx): Promise<boolean> {
  // Read-only update check. Supervisor data is best-effort; never fails the endpoint.
  let supervisor: Awaited<ReturnType<RouteCtx['supervisor']['hasswrightUpdate']>> = null;
  try {
    supervisor = await c.supervisor.hasswrightUpdate();
  } catch { supervisor = null; }
  return (send(res, 200, {
    version: {
      installed: ADDON_VERSION,
      slug: ADDON_SLUG,
      repository: ADDON_REPOSITORY,
      supervisor,
      howToUpdate: 'Settings → Add-ons → Hasswright → Update (⋮ → Check for updates if none shows). See DOCS.md “Updating”.',
    },
  }), true);
}
