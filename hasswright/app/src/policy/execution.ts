import fs from 'node:fs';
import path from 'node:path';
import type { HACore } from '../ha/core.js';
import type { Store } from '../storage.js';
import { redactSecrets } from '../types.js';

// File access: allowlist only, traversal-proof, .storage denied.
const ALLOWED_DIRS = ['/homeassistant', '/config', '/share', '/backup', '/ssl', '/media', '/data', './demo-ha'];
const ALLOWED_EXT = new Set(['.yaml', '.yml', '.json', '.log', '.txt', '.md', '.jinja', '.jinja2']);

export function resolveAllowed(p: string, baseDirs = ALLOWED_DIRS): string {
  const abs = path.resolve(p);
  if (abs.includes('.storage')) throw new Error('access to .storage is denied');
  const ok = baseDirs.some((d) => abs === path.resolve(d) || abs.startsWith(path.resolve(d) + path.sep));
  if (!ok) throw new Error(`path not allowed: ${p}`);
  return abs;
}

export function ensureExt(abs: string): void {
  if (!ALLOWED_EXT.has(path.extname(abs).toLowerCase())) throw new Error(`extension not allowed: ${abs}`);
}

export function snapshotFiles(store: Store, label: string, files: string[]): string {
  const id = `snap-${Date.now()}`;
  const data: Record<string, string> = {};
  for (const f of files) {
    try { data[f] = fs.readFileSync(resolveAllowed(f), 'utf8'); } catch { data[f] = ''; }
  }
  store.putSnapshot({ id, ts: Date.now(), label, files: data });
  return id;
}

export function rollbackFiles(store: Store, snapshotId: string): string[] {
  const s = store.getSnapshot(snapshotId);
  if (!s) throw new Error('snapshot not found');
  const restored: string[] = [];
  for (const [f, content] of Object.entries(s.files)) {
    const abs = resolveAllowed(f);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    restored.push(f);
  }
  return restored;
}

// Change pipeline: plan → approve → snapshot → recheck → apply → validate → verify.
export interface ChangePlan {
  tool: string;
  target: string;
  diff: string;
  risk: string;
}

export async function applyFileChange(
  store: Store, ha: HACore,
  plan: { path: string; oldText: string; newText: string },
  expectedBefore?: string,
): Promise<{ ok: boolean; snapshotId: string; validation: unknown }> {
  const abs = resolveAllowed(plan.path);
  ensureExt(abs);
  const current = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
  if (expectedBefore !== undefined && current !== expectedBefore) {
    throw new Error('target changed since plan (optimistic concurrency conflict); re-plan required');
  }
  const snapshotId = await snapshotFiles(store, `pre-edit ${plan.path}`, [plan.path]);
  let next: string;
  if (plan.oldText === '' && current === '') next = plan.newText;
  else if (current.includes(plan.oldText)) next = current.replace(plan.oldText, plan.newText);
  else throw new Error('oldText not found in target');
  fs.writeFileSync(abs, next);
  const validation = await ha.checkConfig().catch((e) => ({ result: 'unknown', errors: String(e) }));
  if ((validation as { result?: string }).result === 'invalid') {
    rollbackFiles(store, snapshotId);
    throw new Error(`validation failed; rolled back: ${(validation as { errors?: string }).errors}`);
  }
  store.audit({ ts: Date.now(), actor: 'agent', action: 'file.apply', tool: 'ha.write_file', result: 'ok', detail: String(redactSecrets(plan.path)) });
  return { ok: true, snapshotId, validation };
}
