# INSTALLATION.md

1. Copy this repo (or add its URL) as a custom repository: HA → Settings → Apps → ⋮ → Repositories → add repo URL.
2. Install **Hasswright**, Start it, enable **Show in sidebar**.
3. Open Hasswright → onboarding runs environment + capability check.
4. Providers: set `opencode_base_url` (or run OpenCode alongside) and authenticate in OpenCode; or use built-in mock for read-only exploration.
5. Default mode is `observe`. Switch to `assist`/`managed` in add-on options when ready.

Local dev: `cd hasswright/app && npm install && npm run build && npm start` (uses `.hasswright-data/`, mock agent, demo HA unless `HA_BASE_URL`/`HA_TOKEN` set).
