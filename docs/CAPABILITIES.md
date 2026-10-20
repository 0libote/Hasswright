# CAPABILITIES.md — support matrix

| Capability | Status | Mechanism |
|---|---|---|
| Install as HA app | ✅ | `hasswright/config.yaml` + Ingress |
| Task workspace + home context | ✅ | Inline task input/results and saved tasks, direct gateway-backed configuration/log checks, entity search and change review; sessions API (request/reply) |
| Multi-arch image publication | Prepared; not yet activated | Native container smoke tests and GHCR release workflow; source installs retained until public images are verified |
| Home Assistant appearance | ✅ in same-origin Ingress | Live theme-variable bridge to Astryx; system light/dark fallback for direct/cross-origin access |
| Provider auth (OpenCode OAuth/API, local models) | ✅ via OpenCode | OpenCode server handles providers; Hasswright passes through |
| Read states/log/registries | ✅ clients implemented | Core REST + WS; live HA validation pending |
| Automation traces/repairs | ⚠️ verify capability support | Existing WS paths/fallbacks need on-device verification |
| Entity search, dependencies, stale refs | ✅ | ContextEngine |
| Automation draft/preview/apply | ⚠️ experimental | Drafts available; full template/apply/rollback verification remains incomplete (see audit) |
| Dashboard fragment updates | ⚠️ experimental | Approval-gated file path; production-safe YAML pipeline still required |
| Targeted YAML edits + rollback | ⚠️ incomplete | Existing gateway write path does not guarantee rollback on validation failure |
| Backups create/list | ✅ | Supervisor (manager role); creation needs exact single-use approval and is blocked in Observe |
| Restore backup | ❌ not implemented | Gateway refuses restore; use Supervisor backup/restore UI |
| Integration setup flows needing physical action | ⚠️ guided only | documented; no fake pairing |
| Codex backend | ❌ stub | Not wired to a real runtime in this release |
| Optional custom integration | ❌ placeholder | Registers a config entry; no privileged endpoint is implemented |
| Scheduled maintenance | ❌ not wired | Status flag and read-only check class exist; no scheduler invokes them |
| Host-root shell | ❌ unsupported | intentional; documented |
| Container builds | Prepared | Docker Buildx workflows; activation and real HAOS validation pending |

`hab` in the original brief refers to Home Assistant build tooling; runtime uses Supervisor API, not shell.

See [install/update audit](INSTALL-UPDATE-AUDIT.md) for evidence, validation limits and remaining release blockers.
