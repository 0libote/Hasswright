import { randomUUID } from 'node:crypto';
import type { Approval, Risk } from '../types.js';
import type { Store } from '../storage.js';

const TTL_MS = 10 * 60_000;

export class Approvals {
  constructor(private readonly store: Store) {}

  request(tool: string, args: Record<string, unknown>, risk: Risk, preview?: string): Approval {
    const now = Date.now();
    const a: Approval = {
      id: randomUUID(), tool, args, risk, status: 'pending',
      createdAt: now, expiresAt: now + TTL_MS, preview,
    };
    this.store.putApproval(a);
    this.store.audit({ ts: now, actor: 'policy', action: 'approval.requested', tool, result: 'pending', detail: a.id });
    return a;
  }

  decide(id: string, approve: boolean): Approval {
    const a = this.store.getApproval(id);
    if (!a) throw new Error('approval not found');
    if (a.status !== 'pending') throw new Error('approval already decided');
    if (Date.now() > a.expiresAt) {
      a.status = 'expired';
      this.store.putApproval(a);
      throw new Error('approval expired');
    }
    a.status = approve ? 'approved' : 'rejected';
    a.decidedAt = Date.now();
    this.store.putApproval(a);
    this.store.audit({ ts: Date.now(), actor: 'user', action: approve ? 'approval.granted' : 'approval.rejected', tool: a.tool, result: a.status, detail: id });
    return a;
  }

  consume(id: string): Approval {
    // Single-use: fetch an approved, unexpired approval for execution.
    const a = this.store.getApproval(id);
    if (!a) throw new Error('approval not found');
    if (a.status !== 'approved') throw new Error('approval not granted');
    if (Date.now() > a.expiresAt) throw new Error('approval expired');
    a.status = 'expired'; // single-use
    this.store.putApproval(a);
    return { ...a, status: 'approved' };
  }
}
