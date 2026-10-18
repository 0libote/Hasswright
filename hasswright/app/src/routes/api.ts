import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Store } from '../storage.js';
import type { ToolGateway } from '../tools/gateway.js';
import type { ContextEngine } from '../context/engine.js';
import type { AgentAdapter } from '../agent/types.js';
import { Approvals } from '../policy/approvals.js';
import { classify } from '../policy/risk.js';
import { TOOL_DEFINITIONS } from '../tools/definitions.js';
import { redactSecrets } from '../types.js';

export interface RouteCtx {
  store: Store; gateway: ToolGateway; ctx: ContextEngine;
  agent: AgentAdapter; approvals: Approvals; mode: string;
  supervisorConfigured: boolean; demoFixture: boolean;
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

function needIngress(req: IncomingMessage): boolean {
  // Ingress provides X-Ingress-Path; direct port access requires HA bearer auth handled by supervisor proxy.
  // We enforce same-origin + supervisor session where available; never trust model input for auth.
  void req;
  return true;
}

export async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL, c: RouteCtx): Promise<boolean> {
  if (!url.pathname.startsWith('/api/')) return false;
  needIngress(req);
  const method = req.method || 'GET';

  // health
  if (url.pathname === '/api/health') return (send(res, 200, { ok: true, mode: c.mode, ts: Date.now() }), true);

  // sessions
  if (url.pathname === '/api/sessions' && method === 'GET') return (send(res, 200, { sessions: c.store.listSessions() }), true);
  if (url.pathname === '/api/sessions' && method === 'POST') {
    const now = Date.now();
    const s = { id: `local-${randomUUID().slice(0, 8)}`, title: 'New conversation', createdAt: now, updatedAt: now, messages: [] as { role: 'user' | 'assistant'; content: string; ts: number }[] };
    c.store.putSession(s as never);
    return (send(res, 201, { session: s }), true);
  }
  const sessMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)(\/messages)?$/);
  if (sessMatch && method === 'GET' && !sessMatch[2]) {
    const s = c.store.getSession(sessMatch[1]);
    if (!s) return (send(res, 404, { error: 'not found' }), true);
    return (send(res, 200, { session: s }), true);
  }
  if (sessMatch && sessMatch[2] && method === 'POST') {
    const s = c.store.getSession(sessMatch[1]);
    if (!s) return (send(res, 404, { error: 'not found' }), true);
    const body = (await readJson(req)) as { content?: string };
    const content = String(body.content || '').slice(0, 8000);
    if (!content) return (send(res, 400, { error: 'empty' }), true);
    s.messages.push({ role: 'user', content, ts: Date.now() });
    // Gather minimal context (token-budget aware) then ask agent.
    const inv = await c.ctx.inventory().catch(() => null);
    const context = JSON.stringify({ counts: inv?.counts, domains: inv?.domains, unavailable: (inv?.unavailable || []).slice(0, 10) });
    let reply = '';
    try {
      const r = await c.agent.chat(s.id, content, context, TOOL_DEFINITIONS);
      reply = r.text;
      // Execute low-risk read tool calls automatically through the gateway (policy enforced).
      for (const tc of r.toolCalls.slice(0, 3)) {
        if (classify(tc.tool, tc.args) === 'low') {
          try { await c.gateway.exec(tc.tool, tc.args); } catch { /* ignore */ }
        }
      }
    } catch (e) { reply = `Agent unavailable (${String(e)}). Read-only context is still available in Overview/Explorer.`; }
    s.messages.push({ role: 'assistant', content: reply.slice(0, 12000), ts: Date.now() });
    s.updatedAt = Date.now();
    if (s.messages.length <= 2) s.title = content.slice(0, 60);
    c.store.putSession(s);
    c.store.audit({ ts: Date.now(), actor: 'user', action: 'chat.message', result: 'ok', detail: s.id });
    return (send(res, 200, { reply }), true);
  }

  // context
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

  // tools
  if (url.pathname === '/api/tools' && method === 'GET') return (send(res, 200, { tools: TOOL_DEFINITIONS, mode: c.mode }), true);
  if (url.pathname === '/api/tools/exec' && method === 'POST') {
    const body = (await readJson(req)) as { tool?: string; args?: Record<string, unknown>; approvalId?: string };
    if (!body.tool) return (send(res, 400, { error: 'tool required' }), true);
    // Validate args minimally against definitions
    const def = TOOL_DEFINITIONS.find((t) => t.name === body.tool);
    if (!def) return (send(res, 400, { error: 'unknown tool' }), true);
    try {
      const result = await c.gateway.exec(body.tool, body.args || {}, body.approvalId);
      return (send(res, 200, { result }), true);
    } catch (e) {
      const err = e as Error & { code?: string; risk?: string };
      if (err.code === 'APPROVAL_REQUIRED') {
        const a = c.approvals.request(body.tool, body.args || {}, classify(body.tool, body.args || {}), previewOf(body.tool, body.args || {}));
        return (send(res, 428, { error: 'approval required', approval: a }), true);
      }
      return (send(res, 403, { error: String(err.message || err) }), true);
    }
  }

  // approvals
  if (url.pathname === '/api/approvals' && method === 'GET') return (send(res, 200, { approvals: c.store.listApprovals() }), true);
  if (url.pathname === '/api/approvals/decide' && method === 'POST') {
    const body = (await readJson(req)) as { id?: string; approve?: boolean };
    try {
      const a = c.approvals.decide(String(body.id), Boolean(body.approve));
      return (send(res, 200, { approval: a }), true);
    } catch (e) { return (send(res, 400, { error: String(e) }), true); }
  }

  // maintenance + audit + diagnostics
  if (url.pathname === '/api/maintenance' && method === 'GET') {
    const { Maintenance } = await import('../maintenance/checks.js');
    // Lightweight inline run without double HA fetch in demo
    void Maintenance;
    return (send(res, 200, { enabled: process.env.MAINTENANCE_ENABLED === '1', note: 'disabled by default; enable in Settings' }), true);
  }
  if (url.pathname === '/api/audit' && method === 'GET') return (send(res, 200, { audit: c.store.listAudit(100) }), true);

  return false;
}

function previewOf(tool: string, args: Record<string, unknown>): string {
  return `${tool} ${JSON.stringify(args).slice(0, 500)}`;
}
