// Home Assistant Core REST + WebSocket client (official APIs only).
export interface HAState {
  entity_id: string; state: string; attributes: Record<string, unknown>;
  last_changed: string; last_updated: string;
}

export interface HACheckResult { result: 'valid' | 'invalid'; errors: string | null; warnings: string | null; }

export class HACore {
  constructor(private baseUrl: string, private token: string) {}

  get configured(): boolean { return this.baseUrl.length > 0; }
  get hasAuth(): boolean { return this.token.length > 0; }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', ...extra };
  }

  async api(path: string, init?: RequestInit): Promise<Response> {
    const url = this.baseUrl.replace(/\/$/, '') + path;
    return fetch(url, { ...init, headers: { ...(init?.headers as object || {}), ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) } });
  }

  async getConfig(): Promise<unknown> {
    const r = await this.api('/api/config');
    if (!r.ok) throw new Error(`HA config failed: ${r.status}`);
    return r.json();
  }

  async getStates(): Promise<HAState[]> {
    const r = await this.api('/api/states');
    if (!r.ok) throw new Error(`HA states failed: ${r.status}`);
    return r.json() as Promise<HAState[]>;
  }

  async getState(entityId: string): Promise<HAState | null> {
    const r = await this.api(`/api/states/${encodeURIComponent(entityId)}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`HA state failed: ${r.status}`);
    return r.json() as Promise<HAState>;
  }

  async callService(domain: string, service: string, data: Record<string, unknown> = {}): Promise<unknown> {
    const r = await this.api(`/api/services/${domain}/${service}`, { method: 'POST', body: JSON.stringify(data) });
    if (!r.ok) throw new Error(`service call failed: ${r.status} ${await r.text()}`);
    return r.json().catch(() => ({}));
  }

  async checkConfig(): Promise<HACheckResult> {
    const r = await this.api('/api/config/core/check_config', { method: 'POST', body: '{}' });
    if (r.status === 404) return { result: 'valid', errors: null, warnings: 'check_config unavailable' };
    if (!r.ok) throw new Error(`check_config failed: ${r.status}`);
    return r.json() as Promise<HACheckResult>;
  }

  async renderTemplate(template: string): Promise<string> {
    const r = await this.api('/api/template', { method: 'POST', body: JSON.stringify({ template }) });
    if (!r.ok) throw new Error(`template render failed: ${r.status}`);
    return r.text();
  }

  async getLog(): Promise<string> {
    const r = await this.api('/api/error_log');
    if (!r.ok) throw new Error(`error_log failed: ${r.status}`);
    return r.text();
  }

  async getServices(): Promise<unknown> {
    const r = await this.api('/api/services');
    if (!r.ok) throw new Error(`services failed: ${r.status}`);
    return r.json();
  }

  // WebSocket: minimal one-shot command helper over HA WS API.
  async wsCommand(message: Record<string, unknown>, timeoutMs = 8000): Promise<unknown> {
    const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/api/websocket';
    const WS = (globalThis as unknown as { WebSocket?: typeof WebSocket }).WebSocket;
    if (!WS) throw new Error('WebSocket not available in this runtime');
    return new Promise((resolve, reject) => {
      const ws = new WS(wsUrl);
      let id = 1;
      const timer = setTimeout(() => { try { ws.close(); } catch {} reject(new Error('WS timeout')); }, timeoutMs);
      ws.onmessage = (ev: MessageEvent) => {
        try {
          const msg = JSON.parse(String(ev.data));
          if (msg.type === 'auth_required') {
            ws.send(JSON.stringify({ type: 'auth', access_token: this.token }));
          } else if (msg.type === 'auth_ok') {
            ws.send(JSON.stringify({ id: id++, ...message }));
          } else if (msg.type === 'result') {
            clearTimeout(timer);
            ws.close();
            if (msg.success) resolve(msg.result);
            else reject(new Error(msg.error?.message || 'WS command failed'));
          }
        } catch (e) { clearTimeout(timer); reject(e); }
      };
      ws.onerror = () => { clearTimeout(timer); reject(new Error('WS error')); };
    });
  }

  // Supported registries/diagnostics via WS (frontend uses these same commands).
  async wsRegistries(): Promise<{ devices: unknown; entities: unknown; areas: unknown; floor?: unknown }> {
    const [devices, entities, areas] = await Promise.all([
      this.wsCommand({ type: 'config/device_registry/list' }).catch(() => []),
      this.wsCommand({ type: 'config/entity_registry/list' }).catch(() => []),
      this.wsCommand({ type: 'config/area_registry/list' }).catch(() => []),
    ]);
    return { devices, entities, areas };
  }

  async getAutomationTrace(entityId: string): Promise<unknown> {
    return this.wsCommand({ type: 'automation/trace/get', entity_id: entityId }).catch(() => null);
  }

  async getRepairs(): Promise<unknown> {
    return this.wsCommand({ type: 'repairs/list_issues' }).catch(() => ({ issues: [] }));
  }
}
