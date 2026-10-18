import type { ContextEngine } from '../context/engine.js';
import type { HACore } from '../ha/core.js';

// Read-only checks; disabled by default. Findings are deterministic; the model only interprets.
export interface Finding { id: string; severity: 'info' | 'warn' | 'error'; title: string; detail: string; entity?: string }

export class Maintenance {
  enabled = process.env.MAINTENANCE_ENABLED === '1';
  constructor(private readonly ha: HACore, private readonly ctx: ContextEngine) {}

  async runOnce(): Promise<Finding[]> {
    const out: Finding[] = [];
    const inv = await this.ctx.inventory().catch(() => null);
    if (inv) {
      for (const u of inv.unavailable.slice(0, 20)) {
        out.push({ id: `unavail:${u.entity_id}`, severity: 'warn', title: `Unavailable: ${u.entity_id}`, detail: 'Entity is unavailable; check integration/device power and radio link.', entity: u.entity_id });
      }
      const repairs = (inv.repairs as { issues?: Array<{ issue_id: string; translation_key?: string }> } | null)?.issues || [];
      for (const r of repairs.slice(0, 20)) {
        out.push({ id: `repair:${r.issue_id}`, severity: 'warn', title: `Repair: ${r.issue_id}`, detail: r.translation_key || 'See Settings → Repairs in Home Assistant.' });
      }
    }
    const log = await this.ha.getLog().catch(() => '');
    const errs = log.split('\n').filter((l) => /ERROR|Error|Traceback/.test(l)).slice(-10);
    for (const e of errs) out.push({ id: `log:${hash(e)}`, severity: 'error', title: 'Recurring log error', detail: e.slice(0, 300) });
    return out;
  }
}

function hash(s: string): string {
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + (s.codePointAt(i) ?? 0)) >>> 0;
  return String(h);
}
