# Hasswright add-on

Hasswright runs as a Home Assistant app (add-on) with Ingress. Open it from the sidebar.

## Data

Persistent data lives in `/data` (sessions, settings, approvals, audit, snapshots).

## Options

- `log_level`: info/debug/warning/error
- `opencode_base_url`: optional external OpenCode server (default: built-in mock + HA tools)
- `codex_enabled`: enable experimental Codex adapter (default false)
- `mode`: `observe` (default), `assist`, or `managed`

## Ports

Ingress only by default. The optional `8099/tcp` mapping is off by default. Supervisor-backed deployments
accept UI/API traffic only through the Ingress proxy; direct port access is denied.

## Updating

Updates come from Supervisor, not from this UI:

1. **Settings → Add-ons → Hasswright → Update.**
2. No button? **⋮ → Check for updates**, then **Settings → Apps → ⋮ → Reload**.
3. If the build fails, collect Supervisor logs and record the versions and CPU
   architecture. Do not uninstall or delete data as an update workaround.
4. Verify in Hasswright → **Settings → Installation & updates**.

Your `/data` (sessions, settings, approvals, audit) survives updates. `backup: hot`
allows backups while running; take or select a backup explicitly before updating. See `docs/INSTALLATION.md` for details.

Source installations compile the app on your HA device. Prebuilt delivery is being
prepared; do not assume a successful CI unit-test run proves an image installs.
The repository's `docs/INSTALL-UPDATE-AUDIT.md` records the audit and release checklist.
