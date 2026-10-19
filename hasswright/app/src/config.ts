import fs from 'node:fs';
import path from 'node:path';

export interface AppConfig {
  port: number;
  dataDir: string;
  mode: 'observe' | 'assist' | 'managed';
  logLevel: string;
  haBaseUrl: string;      // e.g. http://supervisor/core or http://homeassistant:8123
  haToken: string;        // SUPERVISOR_TOKEN or long-lived token
  supervisorBaseUrl: string;
  supervisorToken: string;
  opencodeBaseUrl: string;
  codexEnabled: boolean;
  demo: boolean;
}

function readOptionsFile(): Record<string, unknown> {
  for (const p of ['/data/options.json', './options.json']) {
    let raw: string;
    try { raw = fs.readFileSync(p, 'utf8'); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw new Error('Cannot read add-on options file'); }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      return parsed as Record<string, unknown>;
    } catch { throw new Error('Invalid add-on options JSON; check the add-on Configuration tab'); }
  }
  return {};
}

export function loadConfig(): AppConfig {
  return configFromEnvironment(process.env, readOptionsFile());
}

export function configFromEnvironment(env: NodeJS.ProcessEnv, opts: Record<string, unknown> = {}): AppConfig {
  const port = Number(env.HASSWRIGHT_PORT || env.PORT || 8099);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid HTTP port');
  const mode = String(opts.mode || env.HASSWRIGHT_MODE || 'observe');
  if (!['observe', 'assist', 'managed'].includes(mode)) throw new Error('Invalid policy mode');
  const supervisorToken = env.SUPERVISOR_TOKEN || env.HASSIO_TOKEN || '';
  const dataDir = env.HASSWRIGHT_DATA_DIR || (supervisorToken ? '/data' : path.join(process.cwd(), '.hasswright-data'));
  const haBaseUrl = env.HA_BASE_URL
    || (supervisorToken || env.SUPERVISOR_HOST ? 'http://supervisor/core' : 'http://homeassistant:8123'); // NOSONAR (typescript:S5332) -- internal HA proxy
  const supervisorBaseUrl = env.SUPERVISOR_BASE_URL || 'http://supervisor'; // NOSONAR (typescript:S5332) -- internal Supervisor API
  return {
    port,
    dataDir,
    mode: mode as AppConfig['mode'],
    logLevel: String(opts.log_level || env.LOG_LEVEL || 'info'),
    haBaseUrl,
    haToken: supervisorToken || env.HA_TOKEN || '',
    supervisorBaseUrl,
    supervisorToken,
    opencodeBaseUrl: String(opts.opencode_base_url || env.OPENCODE_BASE_URL || ''),
    codexEnabled: Boolean(opts.codex_enabled ?? (env.CODEX_ENABLED === '1')),
    demo: !supervisorToken && !env.HA_TOKEN,
  };
}
