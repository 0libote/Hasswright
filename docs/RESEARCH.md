# RESEARCH.md — build-vs-reuse assessment (Oct 2026)

## Decisions

| Area | Choice | Rationale |
|---|---|---|
| Add-on packaging | Native Supervisor `config.yaml` (Ingress, `homeassistant_api`, `hassio_role: manager`) | Verified against current `contributors.home-assistant.io/apps/reference/configuration` schema (renamed add-ons→apps). No Docker-compose or manual container setup. |
| Agent runtime | **OpenCode server** (`opencode serve` HTTP API) as primary via `OpenCodeAdapter` | Server exposes `/global/health`, `/session`, `/session/:id/message` (verified from current docs). Session persistence, streaming, provider auth come free. `CodexAdapter` is an experimental stub behind `codex_enabled`. |
| HA tool gateway | **Own minimal gateway** over official Core REST + WS + Supervisor APIs | Reuse assessment below: ha-mcp is excellent but duplicating all 87 tools adds surface; we implement the ~18 operations Hasswright needs with server-side policy. Documented as compatible: users may also run ha-mcp alongside for extra tools. |
| HA awareness | Own `ContextEngine` (REST states + WS registries + repairs/traces) | Deterministic extraction; model explains only. No full-dump-into-context. |
| Storage | JSON file store in `/data` | No native modules (better-sqlite3 breaks aarch64 builds); survives restarts/upgrades via `data` map. SQLite migration is a clean extension point. |
| Frontend | Static HTML/CSS/JS, no build step | Served by backend; works under Ingress path rewriting. |

## Projects reviewed

- **ha-mcp** (MIT, 87 tools, active, HACS + add-on + in-process component): most mature tool server. Reused conceptually (tool taxonomy, read-only mode, beta flags); did not embed (would duplicate policy surface). Users can point Hasswright at ha-mcp as an extra MCP source in future.
- **Home Assistant built-in MCP Server** (Assist-based): voice-style control only; no automations/dashboards/traces. Insufficient for Hasswright's scope.
- **opencode HA add-ons** (magnusoverli/opencode, drakonizer/opencode-ha-addon): wrap raw OpenCode without HA awareness/policy. Reused the OpenCode-server pattern, not the code.
- **Home Assistant Builder (hab)**: build CLI for add-ons; referenced for image publishing, not vendored.
- **Home Generative Agent / HA Housekeeper**: research references for proactive diagnostics UX; own read-only `Maintenance` implemented instead.

## Licenses/attribution

Own code: MIT. No vendored upstream code. OpenCode/Codex are external runtimes (user-provided).
