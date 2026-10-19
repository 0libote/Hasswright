import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { HACore } from '../ha/core.js';
import type { Supervisor } from '../ha/supervisor.js';
import type { Store } from '../storage.js';
import type { Mode } from '../types.js';
import { redactSecrets } from '../types.js';
import { classify, mayExecute } from '../policy/risk.js';
import { resolveAllowed, ensureExt, snapshotFiles } from '../policy/execution.js';
import type { ContextEngine } from '../context/engine.js';

export interface GatewayOpts {
  mode: Mode;
  ha: HACore;
  supervisor: Supervisor;
  store: Store;
  ctx: ContextEngine;
  configDir: string; // allowlisted demo/config dir for local ops
}

// Single choke point: every effectful route AND every agent tool call goes here.
export class ToolGateway {
  constructor(private readonly o: GatewayOpts) {}

  describe(): unknown {
    return { mode: this.o.mode, tools: 'see /api/tools' };
  }

  private check(tool: string, args: Record<string, unknown>, approvalId?: string): { approved: boolean } {
    try { return this.authorize(tool, args, approvalId); }
    catch (error) {
      storeDenial(this.o.store, tool, error);
      throw error;
    }
  }

  private authorize(tool: string, args: Record<string, unknown>, approvalId?: string): { approved: boolean } {
    const risk = classify(tool, args);
    if (risk === 'low') return { approved: true };
    if (this.o.mode === 'observe') throw Object.assign(new Error('observe mode is read-only'), { code: 'DENIED' });
    if (!approvalId) {
      const gate = mayExecute(this.o.mode, risk, false);
      if (!gate.ok) throw Object.assign(new Error(gate.reason), { code: 'APPROVAL_REQUIRED', risk });
      throw Object.assign(new Error('approval required'), { code: 'APPROVAL_REQUIRED', risk });
    }
    const a = this.o.store.getApproval(approvalId);
    if (a?.status !== 'approved' || Date.now() > (a?.expiresAt ?? 0)) {
      throw Object.assign(new Error('invalid or expired approval'), { code: 'APPROVAL_INVALID' });
    }
    if (a.tool !== tool) throw Object.assign(new Error('approval tool mismatch'), { code: 'APPROVAL_MISMATCH' });
    if (!isDeepStrictEqual(a.args, args)) throw Object.assign(new Error('approval arguments mismatch; request a new approval'), { code: 'APPROVAL_MISMATCH' });
    const gate = mayExecute(this.o.mode, risk, true);
    if (!gate.ok) throw Object.assign(new Error(gate.reason), { code: 'DENIED' });
    // consume single-use
    a.status = 'expired';
    this.o.store.putApproval(a);
    return { approved: true };
  }

  async exec(tool: string, args: Record<string, unknown> = {}, approvalId?: string): Promise<unknown> {
    const { ha, supervisor, store, ctx } = this.o;
    switch (tool) {
      case 'ha.get_overview': {
        const inv = await ctx.inventory();
        return redactSecrets({ ...inv, mode: this.o.mode });
      }
      case 'ha.search_entities': return redactSecrets(ctx.search(toText(args.query)));
      case 'ha.get_state': return redactSecrets(await ha.getState(toText(args.entity_id)));
      case 'ha.get_log': {
        const log = await ha.getLog().catch(() => '(log unavailable in demo)');
        const max = Number(args.max_chars || 8000);
        return redactSecrets(log.slice(-max));
      }
      case 'ha.get_trace': return redactSecrets(await ha.getAutomationTrace(toText(args.entity_id)));
      case 'ha.get_repairs': return redactSecrets(await ha.getRepairs());
      case 'ha.check_config': return ha.checkConfig().catch(() => ({ result: 'unknown' as const }));
      case 'ha.render_template': return ha.renderTemplate(toText(args.template)).catch(() => '(render unavailable in demo)');
      case 'ha.list_files': {
        const dir = resolveAllowed(String(args.dir));
        return fs.readdirSync(dir, { withFileTypes: true }).map((e) => ({ name: e.name, dir: e.isDirectory() }));
      }
      case 'ha.read_file': {
        const abs = resolveAllowed(String(args.path)); ensureExt(abs);
        return redactSecrets(fs.readFileSync(abs, 'utf8').slice(0, 50_000));
      }
      case 'ha.call_service': {
        this.check(tool, args, approvalId);
        const r = await ha.callService(String(args.domain), String(args.service), (args.data as Record<string, unknown>) || {});
        store.audit({ ts: Date.now(), actor: 'agent', action: 'service.call', tool, result: 'ok', detail: `${args.domain}.${args.service}` });
        return redactSecrets(r);
      }
      case 'ha.create_automation_draft': {
        const auto = args.automation as Record<string, unknown>;
        if (!auto || !(auto as { trigger?: unknown }).trigger) throw new Error('automation needs trigger');
        return { valid: true, preview: previewAutomation(auto) };
      }
      case 'ha.apply_automation':
      case 'ha.update_dashboard':
      case 'ha.write_file': {
        this.check(tool, args, approvalId);
        const p = String(args.path);
        const abs = resolveAllowed(p); ensureExt(abs);
        if (!fs.existsSync(abs)) throw new Error('target file does not exist (no implicit creation for config targets)');
        const snap = snapshotFiles(store, `pre-edit ${p}`, [p]);
        const cur = fs.readFileSync(abs, 'utf8');
        const oldText = toText(args.old_text);
        const newText = typeof args.new_text === 'string' ? args.new_text : JSON.stringify(args.new_text ?? args.fragment ?? args.automation ?? '');
        if (oldText && !cur.includes(oldText)) throw new Error('old_text not found; re-plan required');
        fs.writeFileSync(abs, oldText ? cur.replace(oldText, newText) : cur + '\n' + newText);
        const validation = await ha.checkConfig().catch(() => ({ result: 'unknown' as const }));
        store.audit({ ts: Date.now(), actor: 'agent', action: 'file.apply', tool, result: 'ok', detail: p });
        return { ok: true, snapshotId: snap, validation };
      }
      case 'ha.create_backup': {
        this.check(tool, args, approvalId);
        if (!supervisor.configured) return { ok: false, reason: 'supervisor not available (demo or missing token)' };
        const backup = await supervisor.createBackup(toText(args.name) || `hasswright-${Date.now()}`);
        store.audit({ ts: Date.now(), actor: 'agent', action: 'backup.create', tool, result: 'ok' });
        return backup;
      }
      case 'ha.restart_core': {
        this.check(tool, args, approvalId);
        const r = await ha.callService('homeassistant', 'restart', {}).catch((e) => ({ error: String(e) }));
        store.audit({ ts: Date.now(), actor: 'agent', action: 'core.restart', tool, result: 'ok' });
        return r;
      }
      case 'ha.restore_backup':
        throw Object.assign(new Error('restore requires critical approval + explicit backup slug; use Changes UI'), { code: 'APPROVAL_REQUIRED', risk: 'critical' });
      default: throw new Error(`unknown tool: ${tool}`);
    }
  }
}

function storeDenial(store: Store, tool: string, error: unknown): void {
  store.audit({ ts: Date.now(), actor: 'policy', action: 'tool.denied', tool, result: 'denied', detail: (error as { code?: string }).code || 'DENIED' });
}

function toText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v === undefined || v === null) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try { return JSON.stringify(v) ?? ''; } catch { return ''; }
}

function previewAutomation(auto: Record<string, unknown>): string {
  const trig = JSON.stringify((auto as { trigger?: unknown }).trigger);
  const act = JSON.stringify((auto as { action?: unknown }).action);
  return `When ${trig} then ${act}`;
}

export { path as _path };
