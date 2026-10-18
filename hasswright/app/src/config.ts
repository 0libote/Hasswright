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
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { /* ignore */ }
  }
  return {};
}

export function loadConfig(): AppConfig {
  const opts = readOptionsFile();
  const port = Number(process.env.HASSWRIGHT_PORT || process.env.PORT || 8099);
  const dataDir = process.env.HASSWRIGHT_DATA_DIR || path.join(process.cwd(), '.hasswright-data');
  const haBaseUrl = process.env.HA_BASE_URL
    || (process.env.SUPERVISOR_HOST ? 'http://supervisor/core' : 'http://homeassistant:8123'); // NOSONAR (typescript:S5332) -- HA-internal plain HTTP; no TLS by platform design
  const supervisorBaseUrl = process.env.SUPERVISOR_BASE_URL || 'http://supervisor'; // NOSONAR (typescript:S5332) -- Supervisor API is HTTP-only on the internal Docker network
  return {
    port,
    dataDir,
    mode: (String(opts.mode || process.env.HASSWRIGHT_MODE || 'observe') as AppConfig['mode']),
    logLevel: String(opts.log_level || process.env.LOG_LEVEL || 'info'),
    haBaseUrl,
    haToken: process.env.SUPERVISOR_TOKEN || process.env.HA_TOKEN || process.env.HASSIO_TOKEN || '',
    supervisorBaseUrl,
    supervisorToken: process.env.SUPERVISOR_TOKEN || process.env.HASSIO_TOKEN || '',
    opencodeBaseUrl: String(opts.opencode_base_url || process.env.OPENCODE_BASE_URL || ''),
    codexEnabled: Boolean(opts.codex_enabled ?? (process.env.CODEX_ENABLED === '1')),
    demo: !process.env.SUPERVISOR_TOKEN && !process.env.HA_TOKEN,
  };
}
