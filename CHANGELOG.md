# CHANGELOG.md

## 0.1.2
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
