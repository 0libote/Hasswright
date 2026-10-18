import type { AgentAdapter } from './types.js';

// Primary runtime: talks to an OpenCode server (`opencode serve`) via its HTTP API.
// Ref: docs/RESEARCH.md — OpenCode server exposes /global/health, /session, /session/:id/message.
export class OpenCodeAdapter implements AgentAdapter {
  name = 'opencode';
  constructor(private baseUrl: string) {}
  get configured(): boolean { return this.baseUrl.length > 0; }

  async status() {
    if (!this.configured) return { ok: false, detail: 'OPENCODE_BASE_URL not set' };
    try {
      const r = await fetch(this.baseUrl.replace(/\/$/, '') + '/global/health', { signal: AbortSignal.timeout(5000) });
      if (!r.ok) return { ok: false, detail: `health ${r.status}` };
      const j = await r.json().catch(() => ({}));
      return { ok: true, detail: `opencode ${(j as { version?: string }).version || 'ok'}` };
    } catch (e) { return { ok: false, detail: String(e) }; }
  }

  async chat(sessionId: string, prompt: string, context: string, _tools: unknown) {
    const base = this.baseUrl.replace(/\/$/, '');
    // Create/find session then post message; fall back to error text if unreachable.
    let sid = sessionId;
    if (!sid || sid.startsWith('local-')) {
      const r = await fetch(base + '/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Hasswright' }) });
      if (!r.ok) throw new Error(`opencode session create failed: ${r.status}`);
      sid = ((await r.json()) as { id: string }).id;
    }
    const sys = `You are Hasswright, a Home Assistant specialist. Use only provided context; never invent entity IDs. Read-only by default.\nCONTEXT:\n${context.slice(0, 6000)}`;
    const r = await fetch(`${base}/session/${sid}/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: [{ type: 'text', text: `${sys}\n\nUSER: ${prompt}` }] }),
    });
    if (!r.ok) throw new Error(`opencode message failed: ${r.status}`);
    const j = await r.json().catch(() => ({ parts: [] })) as { parts?: Array<{ type: string; text?: string }> };
    const text = (j.parts || []).filter((p) => p.type === 'text').map((p) => p.text || '').join('\n') || '(empty response)';
    return { text, toolCalls: [] as Array<{ tool: string; args: Record<string, unknown> }> };
  }
}
