// Supervisor API client (narrow, documented endpoints only).
export class Supervisor {
  constructor(private readonly baseUrl: string, private readonly token: string) {}
  get configured(): boolean { return this.token.length > 0; }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' };
  }

  async req(path: string, init?: RequestInit): Promise<unknown> {
    const r = await fetch(this.baseUrl.replace(/\/$/, '') + path, { ...init, headers: this.headers() });
    if (!r.ok) throw new Error(`supervisor ${path} failed: ${r.status}`);
    return r.json().catch(() => ({}));
  }

  info = () => this.req('/supervisor/info');
  osInfo = () => this.req('/os/info');
  coreInfo = () => this.req('/core/info');
  listAddons = () => this.req('/addons');
  addonInfo = (slug: string) => this.req(`/addons/${slug}/info`);
  addonLogs = (slug: string) => fetch(`${this.baseUrl}/addons/${slug}/logs`, { headers: this.headers() }).then((r) => r.text());
  backups = () => this.req('/backups');
  createBackup = (name: string) => this.req('/backups/new/full', { method: 'POST', body: JSON.stringify({ name }) });
  updates = () => this.req('/supervisor/update').catch(() => null);
}
