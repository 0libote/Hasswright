// Home Assistant Core REST + WebSocket client (official APIs only).
export interface HAState {
  entity_id: string; state: string; attributes: Record<string, unknown>;
  last_changed: string; last_updated: string;
}

export interface HACheckResult { result: 'valid' | 'invalid'; errors: string | null; warnings: string | null; }

export class HACore {
  constructor(private readonly baseUrl: string, private readonly token: string) {}

  get configured(): boolean { return this.baseUrl.length > 0; }
  get hasAuth(): boolean { return this.token.length > 0; }
  /** Labeled sample data for UI exploration without a HA instance. Env-gated, never used when authed. */
  get fixture(): boolean { return !this.hasAuth && process.env.HASSWRIGHT_DEMO_FIXTURE === '1'; }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', ...extra };
  }

  async api(path: string, init?: RequestInit): Promise<Response> {
    const url = this.baseUrl.replace(/\/$/, '') + path;
    const extra = (init?.headers ?? {}) as Record<string, string>;
    const auth: Record<string, string> = this.token ? { Authorization: `Bearer ${this.token}` } : {};
    return fetch(url, { ...init, signal: init?.signal ?? AbortSignal.timeout(15_000), headers: { ...extra, ...auth } });
  }

  async getConfig(): Promise<unknown> {
    if (this.fixture) return { ...FIXTURE_CONFIG };
    const r = await this.api('/api/config');
    if (!r.ok) throw new Error(`HA config failed: ${r.status}`);
    return r.json();
  }

  async getStates(): Promise<HAState[]> {
    if (this.fixture) return FIXTURE_STATES.map((s) => ({ ...s, attributes: { ...s.attributes } }));
    const r = await this.api('/api/states');
    if (!r.ok) throw new Error(`HA states failed: ${r.status}`);
    return r.json() as Promise<HAState[]>;
  }

  async getState(entityId: string): Promise<HAState | null> {
    if (this.fixture) return FIXTURE_STATES.find((s) => s.entity_id === entityId) || null;
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
    if (this.fixture) return FIXTURE_LOG;
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
    const wsUrl = homeAssistantWebSocketUrl(this.baseUrl);
    const WS = (globalThis as unknown as { WebSocket?: typeof WebSocket }).WebSocket;
    if (!WS) throw new Error('WebSocket not available in this runtime');
    return new Promise((resolve, reject) => {
      const ws = new WS(wsUrl);
      let id = 1;
      const fail = (error: Error) => { clearTimeout(timer); reject(error); try { ws.close(); } catch {} };
      const timer = setTimeout(() => fail(new Error('WS timeout')), timeoutMs);
      ws.onmessage = (ev: MessageEvent) => {
        try {
          const msg = JSON.parse(String(ev.data));
          if (msg.type === 'auth_required') {
            ws.send(JSON.stringify({ type: 'auth', access_token: this.token }));
          } else if (msg.type === 'auth_ok') {
            ws.send(JSON.stringify({ id: id++, ...message }));
          } else if (msg.type === 'auth_invalid') {
            fail(new Error('HA WebSocket authentication failed'));
          } else if (msg.type === 'result') {
            clearTimeout(timer);
            ws.close();
            if (msg.success) resolve(msg.result);
            else reject(new Error(msg.error?.message || 'WS command failed'));
          }
        } catch { fail(new Error('Invalid HA WebSocket response')); }
      };
      ws.onerror = () => fail(new Error('WS error'));
      ws.onclose = () => { clearTimeout(timer); reject(new Error('HA WebSocket closed before returning a result')); };
    });
  }

  // Supported registries/diagnostics via WS (frontend uses these same commands).
  async wsRegistries(): Promise<{ devices: unknown; entities: unknown; areas: unknown; floor?: unknown }> {
    if (this.fixture) return { ...FIXTURE_REGISTRIES };
    const [devices, entities, areas] = await Promise.all([
      this.wsCommand({ type: 'config/device_registry/list' }).catch(() => []),
      this.wsCommand({ type: 'config/entity_registry/list' }).catch(() => []),
      this.wsCommand({ type: 'config/area_registry/list' }).catch(() => []),
    ]);
    return { devices, entities, areas };
  }

  async getAutomationTrace(entityId: string): Promise<unknown> {
    if (this.fixture) return { trace: [], note: 'Sample trace (demo fixture)' };
    return this.wsCommand({ type: 'automation/trace/get', entity_id: entityId }).catch(() => null);
  }

  async getRepairs(): Promise<unknown> {
    if (this.fixture) return { issues: [{ issue_id: 'demo_unavailable_sensor', translation_key: 'Sample repair (demo fixture)' }] };
    return this.wsCommand({ type: 'repairs/list_issues' }).catch(() => ({ issues: [] }));
  }
}

export function homeAssistantWebSocketUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const base = url.pathname.replace(/\/$/, '');
  url.pathname = base.endsWith('/core') ? `${base}/websocket` : `${base}/api/websocket`;
  return url.toString();
}

// ---------------------------------------------------------------------------
// Clearly-labeled sample data for local UI exploration (no HA instance).
// Active ONLY when HASSWRIGHT_DEMO_FIXTURE=1 and no HA token is configured.
// Every entry is synthetic; the UI marks responses with demoFixture: true.
// ---------------------------------------------------------------------------
const FIXTURE_CONFIG = {
  location_name: 'Demo Home (fixture)',
  version: '2026.10.0',
  state: 'RUNNING',
};

const FIXTURE_STATES: HAState[] = [
  { entity_id: 'light.hallway', state: 'on', attributes: { friendly_name: 'Hallway Light' }, last_changed: '', last_updated: '' },
  { entity_id: 'binary_sensor.hallway_motion', state: 'off', attributes: { friendly_name: 'Hallway Motion', device_class: 'motion' }, last_changed: '', last_updated: '' },
  { entity_id: 'sensor.hallway_temperature', state: '21.4', attributes: { friendly_name: 'Hallway Temperature', unit_of_measurement: '°C' }, last_changed: '', last_updated: '' },
  { entity_id: 'sensor.zigbee_door', state: 'unavailable', attributes: { friendly_name: 'Zigbee Door Sensor (sample fault)' }, last_changed: '', last_updated: '' },
  { entity_id: 'automation.hallway_lighting', state: 'on', attributes: { friendly_name: 'Hallway Lighting', trigger: [{ platform: 'state', entity_id: 'binary_sensor.hallway_motion' }] }, last_changed: '', last_updated: '' },
];

const FIXTURE_REGISTRIES = {
  devices: [{ id: 'dev-hall', name: 'Hallway multi-sensor', manufacturer: 'Demo' }],
  entities: FIXTURE_STATES.map((s) => ({ entity_id: s.entity_id, device_id: 'dev-hall' })),
  areas: [{ area_id: 'hall', name: 'Hallway' }],
};

const FIXTURE_LOG = [
  '2026-10-18 10:00:01 INFO demo fixture log (sample data)',
  '2026-10-18 10:01:12 WARNING sensor.zigbee_door became unavailable (sample)',
  '2026-10-18 10:02:03 ERROR Demo integration retrying setup (sample)',
].join('\n');
