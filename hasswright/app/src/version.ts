import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FALLBACK = '0.1.4';

function readPackageVersion(): string {
  if (process.env.HASSWRIGHT_VERSION) return process.env.HASSWRIGHT_VERSION;
  const candidates: string[] = [];
  try {
    // dist/version.js -> ../package.json (dev: src/version.ts -> ../package.json)
    const here = fileURLToPath(import.meta.url);
    candidates.push(path.join(path.dirname(here), '..', 'package.json'));
    candidates.push(path.join(path.dirname(here), '..', '..', 'package.json'));
  } catch { /* ignore */ }
  candidates.push('/app/package.json');
  candidates.push(path.join(process.cwd(), 'package.json'));
  candidates.push(path.join(process.cwd(), 'app', 'package.json'));
  for (const p of candidates) {
    try {
      const raw = fs.readFileSync(p, 'utf8');
      const v = (JSON.parse(raw) as { version?: string }).version;
      if (typeof v === 'string' && v.length > 0) return v;
    } catch { /* try next */ }
  }
  return FALLBACK;
}

export const ADDON_VERSION: string = readPackageVersion();
export const ADDON_SLUG = 'hasswright';
export const ADDON_REPOSITORY = 'https://github.com/0libote/Hasswright';
