// Supervisor API client (narrow, documented endpoints only).
export class Supervisor {
  constructor(private readonly baseUrl: string, private readonly token: string) {}
  get configured(): boolean { return this.token.length > 0; }

  private headers(): Record<string, string> {
    return { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' };
  }

  async req(path: string, init?: RequestInit): Promise<unknown> {
    const r = await fetch(this.baseUrl.replace(/\/$/, '') + path, { ...init, signal: init?.signal ?? AbortSignal.timeout(5000), headers: this.headers() });
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
  createBackup = (name: string) => this.req('/backups/new/full', { method: 'POST', body: JSON.stringify({ name }), signal: AbortSignal.timeout(120_000) });
  updates = () => this.req('/supervisor/update').catch(() => null);

  /** Best-effort read-only update check for this add-on. Never throws; returns null when unknown. */
  async hasswrightUpdate(): Promise<{
    slug: string;
    installed: string | null;
    latest: string | null;
    updateAvailable: boolean | null;
  } | null> {
    if (!this.configured) return null;
    const slugs = ['self', process.env.SUPERVISOR_ADDON_SLUG || ''].filter(Boolean);
    // Try direct info lookups first.
    for (const slug of slugs) {
      try {
        const info = await this.addonInfo(slug);
        const parsed = parseAddonInfo(info);
        const record = asRecord(asRecord(info)?.data) ?? asRecord(info);
        if (parsed) return { slug: typeof record?.slug === 'string' ? record.slug : slug, ...parsed };
      } catch { /* try next */ }
    }
    // Fall back to scanning the add-on list for a slug ending in hasswright.
    try {
      const list = await this.listAddons();
      const found = findHasswrightAddon(list);
      if (found) return found;
    } catch { /* ignore */ }
    return null;
  }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
}

function parseAddonInfo(payload: unknown): {
  installed: string | null;
  latest: string | null;
  updateAvailable: boolean | null;
} | null {
  const root = asRecord(payload);
  const data = asRecord(root?.data) ?? root;
  if (!data) return null;
  const installed = typeof data.version === 'string' ? data.version
    : typeof data.installed === 'string' ? data.installed : null;
  const latest = typeof data.version_latest === 'string' ? data.version_latest
    : typeof data.latest === 'string' ? data.latest : null;
  const updateAvailable = typeof data.update_available === 'boolean' ? data.update_available
    : typeof data.updateAvailable === 'boolean' ? data.updateAvailable
    : installed && latest ? installed !== latest : null;
  if (installed === null && latest === null && updateAvailable === null) return null;
  return { installed, latest, updateAvailable };
}

function findHasswrightAddon(payload: unknown): {
  slug: string;
  installed: string | null;
  latest: string | null;
  updateAvailable: boolean | null;
} | null {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const rawList = Array.isArray(data?.addons) ? data!.addons
    : Array.isArray(root?.addons) ? (root!.addons as unknown[])
    : Array.isArray(payload) ? (payload as unknown[]) : null;
  if (!rawList) return null;
  for (const item of rawList) {
    const rec = asRecord(item);
    const slug = typeof rec?.slug === 'string' ? rec.slug : '';
    if (!slug.endsWith('hasswright')) continue;
    const parsed = parseAddonInfo(item);
    if (parsed) return { slug, ...parsed };
  }
  return null;
}
