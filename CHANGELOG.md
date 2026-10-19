# CHANGELOG.md

## 0.1.7 (prepared)
- Make the installation workspace the starting view; move conversations into an optional assistant panel.
- Fix Supervisor Core REST/WS routing and self update detection; bound network reads and show missing data clearly.
- Use a multi-stage, architecture-neutral build and prepare real native container smoke tests and versioned image publication.
- Fail startup for missing UI assets or corrupt persisted data; preserve existing data across server replacement.
- Enforce Ingress peer access, bind approvals to exact arguments, and require approval for backups.
- Add packaging/version checks and an install/update audit with remaining production blockers.

## 0.1.6
- Replace static Ingress UI with Astryx React + live HA theming (bundled via esbuild WASM into `public/build/`, allowlisted theme vars/fonts with system fallback).
- Bump add-on version so Supervisor picks up the new UI build.

## 0.1.5
- Fix Docker build failure (`./node_modules/.bin/tsc: not found`, exit 127): `ENV NODE_ENV=production` made `npm ci` skip devDependencies including TypeScript. Added `--include=dev` to the install step; `npm prune --omit=dev` after `tsc` still keeps the final image lean.
- Bump add-on version so Supervisor retries the build.

## 0.1.4
- Bump add-on version so Supervisor picks up the build as a new update after the failed `0.1.3` install.
- Sync `package-lock.json` version with `package.json` (was left at `0.1.2`).

## 0.1.3
- Fix update story: correct repository URLs (`repository.yaml`, `config.yaml`, integration manifest pointed at `example/hasswright`).
- Add in-app version: `/api/health` now returns `version`, new read-only `/api/version` reports Supervisor's `update_available` state; Settings shows *Version & updates*.
- Document updates where installed users look: `hasswright/DOCS.md` (Supervisor Docs tab), `docs/INSTALLATION.md`, README.
- Fix Docker build: `npx tsc` resolved to obsolete `tsc@2.0.4` package and failed.
  Use `npm install --include=dev` (pinned devDependencies) + `./node_modules/.bin/tsc`.
- Bump add-on version so Supervisor picks up the fixed Dockerfile.

## 0.1.1
- `HASSWRIGHT_DEMO_FIXTURE=1`: labeled sample data for UI exploration without HA (never active with a real token).
- Dockerfile builds TypeScript in-image instead of COPYing gitignored `dist/`.
- CI validates YAML packaging + add-on keys; issue/PR templates added.

## 0.1.0 — first release
- Installable HA app (Ingress, amd64/aarch64), sidebar UI with 7 sections.
- Sessions + chat (OpenCode primary, Codex experimental, mock fallback).
- Context engine: inventory, search, dependencies, stale refs, redaction.
- 18 typed tools behind policy gateway (approvals, snapshots, validation, audit).
- Optional custom integration (explicit opt-in, narrow API).
- Tests: unit + integration + security (`npm test`).
