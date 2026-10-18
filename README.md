# Hasswright — Your home. Understood.

[![CI](https://github.com/0libote/Hasswright/actions/workflows/ci.yml/badge.svg)](https://github.com/0libote/Hasswright/actions/workflows/ci.yml)
![Node >= 22](https://img.shields.io/badge/node-%3E%3D22-64E6D3)
![License: MIT](https://img.shields.io/badge/license-MIT-EFB76B)
[![Add to Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2F0libote%2FHasswright)

An AI engineering agent for Home Assistant: it **understands** your installation (devices, entities,
automations, logs, repairs), **explains** what's wrong with evidence, and **changes** things only
through approvals, backups, and validation. Default mode is read-only.

> **Status:** working release (`0.1.6`). Installable on HAOS, tested with unit + integration +
> security suites. On-device validation checklist in `docs/DEVELOPMENT.md`.

## What it does

- **Workspace** — chat with a real agent session (OpenCode primary, Codex experimental, built-in fallback).
- **Overview / Explorer** — live inventory: versions, domains, unavailable entities, registries, repairs.
- **Investigations** — error log, repair issues, automation traces with evidence-first diagnoses.
- **Changes** — pending approvals (10-min TTL, single-use), diffs/previews, apply + validate + rollback.
- **Maintenance** — opt-in, disabled-by-default read-only checks. Never auto-repairs.
- **Settings** — tool catalog, audit history, diagnostics.

## Try it in 2 minutes (no Home Assistant needed)

```bash
cd hasswright/app
npm install
npm run build
HASSWRIGHT_DEMO_FIXTURE=1 npm start   # labeled sample data, UI at http://localhost:8099
```

You'll see a hallway with a motion light and one (intentionally) unavailable sensor to investigate.
`demoFixture: true` is marked on every response. **Never enabled when a real HA token is configured.**

## Install on Home Assistant (HAOS)

[![Add to Home Assistant](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2F0libote%2FHasswright)

1. Click **Add to Home Assistant** above (or: Settings → Apps → ⋮ → **Repositories** → add `https://github.com/0libote/Hasswright`).
2. Install **Hasswright** → Start → enable **Show in sidebar**.
3. Open Hasswright: onboarding runs environment + capability checks.
4. Providers: set `opencode_base_url` (or run OpenCode alongside) and sign in there; or explore read-only with the built-in assistant.
5. You start in `observe` (read-only). Switch to `assist`/`managed` in app options when ready.

Details: [`docs/INSTALLATION.md`](docs/INSTALLATION.md).

## Updating an installed add-on

Settings → Add-ons → Hasswright → **Update** (⋮ → **Check for updates** if none
shows). In-app version + Supervisor update state: Hasswright → **Settings → Version
& updates**. Details: [`docs/INSTALLATION.md`](docs/INSTALLATION.md#updating-installed-add-on).

## How it stays safe

- Every mutation funnels through one policy gateway (`src/tools/gateway.ts`): classify → approve → snapshot → recheck → apply → validate → verify. No shell tool is exposed to the model.
- File access is allowlisted and traversal-proof; `.storage`/databases are never written directly.
- Secrets are redacted at the boundary; audit log records every action.
- Full model: [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md), [`SECURITY.md`](SECURITY.md).

## Repo map

| Path | What |
|---|---|
| `hasswright/` | Add-on packaging (`config.yaml`, `Dockerfile`, `run.sh`) + `app/` backend & UI |
| `hasswright/app/src/` | server, agent adapters, HA clients, context engine, tools, policy, routes |
| `hasswright/app/ui/` | Astryx/React Ingress UI with live Home Assistant theming |
| `hasswright/app/public/` | Static shell/assets + generated UI bundle (`npm run build`) |
| `custom_components/hasswright/` | Optional narrow privileged integration (explicit opt-in) |
| `skills/` | Reusable agent procedures (automation, debugging, dashboards, …) |
| `docs/` | RESEARCH, ARCHITECTURE, CAPABILITIES, PERMISSIONS, INSTALLATION, DEVELOPMENT |
| `examples/` | Walkthroughs (e.g. hallway lighting) |

## Development

```bash
cd hasswright/app
npm install && npm run build && npm test   # 16 tests: policy, approvals, paths, gateway, context, fixture
```

Working rules for agents (and humans): [`AGENTS.md`](AGENTS.md). Please read it before contributing —
especially "all mutations go through the gateway" and "never invent entity IDs".

## Contributing

Small, typed, tested PRs. See [`CONTRIBUTING.md`](CONTRIBUTING.md). Bug reports and feature ideas:
use the issue templates. Security issues: please open a private report rather than a public issue
(see [`SECURITY.md`](SECURITY.md)).

## License

MIT — see [`LICENSE`](LICENSE).
