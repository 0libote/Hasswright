# Hasswright add-on

Hasswright runs as a Home Assistant app (add-on) with Ingress. Open it from the sidebar.

## Data

Persistent data lives in `/data` (sessions, settings, approvals, audit, snapshots).

## Options

- `log_level`: info/debug/warning/error
- `opencode_base_url`: optional external OpenCode server (default: managed sidecar/disabled → built-in mock + HA tools)
- `codex_enabled`: enable experimental Codex adapter (default false)
- `mode`: `observe` (default), `assist`, or `managed`

## Ports

Ingress only by default. Exposing `8099/tcp` is optional and off by default.

## Updating

Updates come from Supervisor, not from this UI:

1. **Settings → Add-ons → Hasswright → Update.**
2. No button? **⋮ → Check for updates**, then **Settings → Apps → ⋮ → Reload**.
3. Still stuck? **Rebuild** the add-on, or re-add the repository URL
   `https://github.com/0libote/Hasswright`.
4. Verify in Hasswright → **Settings → Version & updates**.

Your `/data` (sessions, settings, approvals, audit) survives updates. Supervisor
also takes a hot backup on update. See `docs/INSTALLATION.md` for details.
