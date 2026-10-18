# CAPABILITIES.md — support matrix

| Capability | Status | Mechanism |
|---|---|---|
| Install as HA app | ✅ | `hasswright/config.yaml` + Ingress |
| Sidebar + conversational chat | ✅ | Astryx chat components, sessions API (request/reply) |
| Home Assistant appearance | ✅ in same-origin Ingress | Live theme-variable bridge to Astryx; system light/dark fallback for direct/cross-origin access |
| Provider auth (OpenCode OAuth/API, local models) | ✅ via OpenCode | OpenCode server handles providers; Hasswright passes through |
| Read states/log/traces/repairs/registries | ✅ | Core REST + WS |
| Entity search, dependencies, stale refs | ✅ | ContextEngine |
| Automation draft/preview/apply + validation | ✅ | pipeline + `check_config` |
| Dashboard fragment updates | ✅ (approval) | file pipeline |
| Targeted YAML edits + rollback | ✅ | snapshot + recheck + validate |
| Backups create/list | ✅ | Supervisor (manager role) |
| Restore backup | ⚠️ gated | critical approval required |
| Integration setup flows needing physical action | ⚠️ guided only | documented; no fake pairing |
| Codex backend | ⚠️ experimental | `codex_enabled` + `CODEX_BASE_URL` |
| Host-root shell | ❌ unsupported | intentional; documented |
| `hab` build CLI | n/a (build tool) | images published via GH Actions |

`hab` in the original brief refers to Home Assistant build tooling; runtime uses Supervisor API, not shell.
