import type { AgentAdapter } from './types.js';

// Experimental Codex adapter (same Hasswright interface + HA tooling).
// Enabled only when codex_enabled=true AND CODEX_BASE_URL is set; otherwise status() reports unavailable.
export class CodexAdapter implements AgentAdapter {
  name = 'codex';
  constructor(private readonly baseUrl = process.env.CODEX_BASE_URL || '', private readonly enabled = process.env.CODEX_ENABLED === '1') {}
  status(): Promise<{ ok: boolean; detail: string }> {
    if (!this.enabled) return Promise.resolve({ ok: false, detail: 'codex adapter disabled (experimental)' });
    if (!this.baseUrl) return Promise.resolve({ ok: false, detail: 'CODEX_BASE_URL not set' });
    return Promise.resolve({ ok: true, detail: 'codex stub endpoint configured' });
  }
  chat(): Promise<{ text: string; toolCalls: Array<{ tool: string; args: Record<string, unknown> }> }> {
    return Promise.resolve({ text: 'Codex adapter is experimental and not fully wired in this release. Enable OpenCode or use the built-in assistant.', toolCalls: [] as Array<{ tool: string; args: Record<string, unknown> }> });
  }
}
