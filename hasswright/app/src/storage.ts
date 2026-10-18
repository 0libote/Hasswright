import fs from 'node:fs';
import path from 'node:path';
import type { Approval, AuditEntry, ChatSession } from './types.js';

interface DB {
  sessions: Record<string, ChatSession>;
  approvals: Record<string, Approval>;
  audit: AuditEntry[];
  settings: Record<string, unknown>;
  snapshots: Record<string, { id: string; ts: number; label: string; files: Record<string, string> }>;
}

// Minimal durable JSON store (no native deps; survives restarts/upgrades via /data).
export class Store {
  private readonly file: string;
  private readonly db: DB;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    this.file = path.join(dataDir, 'hasswright.json');
    this.db = { sessions: {}, approvals: {}, audit: [], settings: {}, snapshots: {} };
    try {
      const raw = fs.readFileSync(this.file, 'utf8');
      const parsed = JSON.parse(raw) as Partial<DB>;
      this.db = { ...this.db, ...parsed };
    } catch { /* fresh */ }
  }

  private save(): void {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2));
    fs.renameSync(tmp, this.file);
  }

  // sessions
  listSessions(): ChatSession[] {
    return Object.values(this.db.sessions).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  getSession(id: string): ChatSession | undefined { return this.db.sessions[id]; }
  putSession(s: ChatSession): void { this.db.sessions[s.id] = s; this.save(); }
  deleteSession(id: string): void { delete this.db.sessions[id]; this.save(); }

  // approvals
  putApproval(a: Approval): void { this.db.approvals[a.id] = a; this.save(); }
  getApproval(id: string): Approval | undefined { return this.db.approvals[id]; }
  listApprovals(status?: string): Approval[] {
    const all = Object.values(this.db.approvals).sort((a, b) => b.createdAt - a.createdAt);
    return status ? all.filter((a) => a.status === status) : all;
  }

  // audit
  audit(e: AuditEntry): void {
    this.db.audit.push(e);
    if (this.db.audit.length > 2000) this.db.audit = this.db.audit.slice(-2000);
    this.save();
  }
  listAudit(limit = 200): AuditEntry[] { return this.db.audit.slice(-limit).reverse(); }

  getSettings(): Record<string, unknown> { return this.db.settings; }
  putSettings(s: Record<string, unknown>): void { this.db.settings = s; this.save(); }

  putSnapshot(s: DB['snapshots'][string]): void { this.db.snapshots[s.id] = s; this.save(); }
  getSnapshot(id: string) { return this.db.snapshots[id]; }
}
