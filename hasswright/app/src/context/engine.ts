import { redactSecrets } from '../types.js';
import type { HACore } from '../ha/core.js';

export interface Inventory {
  takenAt: number;
  core?: unknown;
  counts: { states: number; devices: number; entities: number; areas: number };
  domains: Record<string, number>;
  unavailable: { entity_id: string; state: string }[];
  failedIntegrations: string[];
  repairs: unknown;
  stale: boolean;
}

export interface GraphNode { id: string; kind: string; label: string }
export interface GraphEdge { from: string; to: string; rel: string }

// Deterministic extraction; the model explains, never invents relationships.
export class ContextEngine {
  private cache: Inventory | null = null;
  private states: Array<{ entity_id: string; state: string; attributes: Record<string, unknown> }> = [];
  private devices: unknown[] = [];
  private entitiesReg: unknown[] = [];
  private areas: unknown[] = [];

  constructor(private readonly ha: HACore) {}

  get lastTakenAt(): number | null { return this.cache?.takenAt ?? null; }

  async inventory(force = false): Promise<Inventory> {
    if (this.cache && !force && Date.now() - this.cache.takenAt < 60_000) return this.markFresh(this.cache);
    const [config, states] = await Promise.all([
      this.ha.getConfig().catch(() => null),
      this.ha.getStates().catch(() => []),
    ]);
    const regs = await this.ha.wsRegistries().catch(() => ({ devices: [], entities: [], areas: [] }));
    this.states = states as typeof this.states;
    this.devices = (regs.devices as unknown[]) || [];
    this.entitiesReg = (regs.entities as unknown[]) || [];
    this.areas = (regs.areas as unknown[]) || [];
    const domains: Record<string, number> = {};
    const unavailable: Inventory['unavailable'] = [];
    for (const s of this.states) {
      const d = s.entity_id.split('.')[0];
      domains[d] = (domains[d] || 0) + 1;
      if (s.state === 'unavailable' || s.state === 'unknown') unavailable.push({ entity_id: s.entity_id, state: s.state });
    }
    const repairs = await this.ha.getRepairs().catch(() => ({ issues: [] }));
    const inv: Inventory = {
      takenAt: Date.now(),
      core: redactSecrets(config),
      counts: {
        states: this.states.length,
        devices: this.devices.length,
        entities: Array.isArray(this.entitiesReg) ? this.entitiesReg.length : this.states.length,
        areas: Array.isArray(this.areas) ? this.areas.length : 0,
      },
      domains, unavailable: unavailable.slice(0, 200), failedIntegrations: [],
      repairs, stale: false,
    };
    this.cache = inv;
    return inv;
  }

  private markFresh(inv: Inventory): Inventory {
    const age = Date.now() - inv.takenAt;
    return { ...inv, stale: age > 5 * 60_000 };
  }

  search(query: string, limit = 25): Array<{ entity_id: string; state: string }> {
    const q = query.toLowerCase();
    return this.states
      .filter((s) => s.entity_id.toLowerCase().includes(q) || JSON.stringify(s.attributes).toLowerCase().includes(q))
      .slice(0, limit)
      .map((s) => ({ entity_id: s.entity_id, state: s.state }));
  }

  // entity → device → area → automations dependency sketch
  dependencies(entityId: string): { entity: unknown; automations: string[]; area?: string } {
    const entity = this.states.find((s) => s.entity_id === entityId) || null;
    const automations = this.states
      .filter((s) => s.entity_id.startsWith('automation.')
        && JSON.stringify(s.attributes).includes(entityId))
      .map((s) => s.entity_id);
    return { entity: redactSecrets(entity), automations, area: undefined };
  }

  staleReferences(knownIds: string[]): string[] {
    const have = new Set(this.states.map((s) => s.entity_id));
    return knownIds.filter((id) => !have.has(id));
  }

  getStatesSnapshot(): unknown[] { return redactSecrets(this.states.slice(0, 500)) as unknown[]; }
}
