# INSTALLATION.md

## Try without Home Assistant

```bash
cd hasswright/app && npm install && npm run build
HASSWRIGHT_DEMO_FIXTURE=1 npm start   # http://localhost:8099
```

Labeled sample data (hallway + one unavailable sensor). Every overview response carries
`demoFixture: true`. Fixture mode is impossible when `HA_TOKEN`/`SUPERVISOR_TOKEN` is set.

## Install on Home Assistant (HAOS)
2. Install **Hasswright**, Start it, enable **Show in sidebar**.
3. Open Hasswright → onboarding runs environment + capability check.
4. Providers: set `opencode_base_url` (or run OpenCode alongside) and authenticate in OpenCode; or use built-in mock for read-only exploration.
5. Default mode is `observe`. Switch to `assist`/`managed` in add-on options when ready.

Local dev: `cd hasswright/app && npm install && npm run build && npm start` (uses `.hasswright-data/`, mock agent, demo HA unless `HA_BASE_URL`/`HA_TOKEN` set).
