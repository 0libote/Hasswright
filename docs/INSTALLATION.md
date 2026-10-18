# INSTALLATION.md

## Try without Home Assistant

```bash
cd hasswright/app && npm install && npm run build
HASSWRIGHT_DEMO_FIXTURE=1 npm start   # http://localhost:8099
```

Labeled sample data (hallway + one unavailable sensor). Every overview response carries
`demoFixture: true`. Fixture mode is impossible when `HA_TOKEN`/`SUPERVISOR_TOKEN` is set.

## Install on Home Assistant (HAOS)

1. Add this repository: Settings → Apps → ⋮ → **Repositories** → add
   `https://github.com/0libote/Hasswright` (or click **Add to Home Assistant** in the README).
2. Install **Hasswright**, Start it, enable **Show in sidebar**.
3. Open Hasswright → onboarding runs environment + capability check.
4. Providers: set `opencode_base_url` (or run OpenCode alongside) and authenticate in OpenCode; or use built-in mock for read-only exploration.
5. Default mode is `observe`. Switch to `assist`/`managed` in add-on options when ready.

Local dev: `cd hasswright/app && npm install && npm run build && npm start` (uses `.hasswright-data/`, mock agent, demo HA unless `HA_BASE_URL`/`HA_TOKEN` set).

## Updating (installed add-on)

Updates are delivered through Home Assistant **Supervisor** — not from inside the
Hasswright UI. When a new version is published (see `CHANGELOG.md` and
`hasswright/config.yaml` `version:`), Supervisor offers an **Update** button:

1. Go to **Settings → Add-ons → Hasswright**.
2. If an update is available, click **Update** (Supervisor stops the old container,
   rebuilds/pulls the new image, and restarts — your `/data`: sessions, settings,
   approvals, audit, snapshots are preserved).
3. If no update shows yet: **⋮ → Check for updates**, then **Settings → Apps → ⋮ →
   Reload** (refreshes the repository), and re-open the Hasswright page.
4. Still nothing? **Rebuild** the add-on from its page, or remove/re-add the
   `https://github.com/0libote/Hasswright` repository and restart Supervisor.
5. Verify: open Hasswright → **Settings** → *Version & updates* shows the new
   version, or check Supervisor's add-on info row.

Notes:

- In-app **Settings → Version & updates** shows the running version and, when the
  Supervisor API is reachable, whether Supervisor reports an update. The actual
  install/restart is always done by Supervisor.
- Backups: Supervisor takes a `hot` backup on update (`backup: hot` in
  `config.yaml`). For extra safety, take a manual backup before major updates:
  **Settings → System → Backups → Create backup**.
- Version numbers: the add-on version (`hasswright/config.yaml`) and the app
  (`hasswright/app/package.json`) are kept in sync. If they differ, treat
  `config.yaml` as the source of truth for what Supervisor installs.
