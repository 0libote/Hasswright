import type { AgentAdapter } from './types.js';

// Experimental Codex adapter (same Hasswright interface + HA tooling).
// Enabled only when codex_enabled=true AND CODEX_BASE_URL is set; otherwise status() reports unavailable.
export class CodexAdapter implements AgentAdapter {
  name = 'codex';
  constructor(private baseUrl = process.env.CODEX_BASE_URL || '', private enabled = process.env.CODEX_ENABLED === '1') {}
  async status() {
    if (!this.enabled) return { ok: false, detail: 'codex adapter disabled (experimental)' };
    if (!this.baseUrl) return { ok: false, detail: 'CODEX_BASE_URL not set' };
    return { ok: true, detail: 'codex stub endpoint configured' };
  }
  async chat() {
    return { text: 'Codex adapter is experimental and not fully wired in this release. Enable OpenCode or use the built-in assistant.', toolCalls: [] as Array<{ tool: string; args: Record<string, unknown> }> };
  }
}
