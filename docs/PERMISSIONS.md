# PERMISSIONS.md

Modes: **observe** (default, read-only) → **assist** (prepare + explicit approval) → **managed** (narrow low-risk auto under policy; high/critical still need approval).

| Operation | Risk | Observe | Assist | Managed |
|---|---|---|---|---|
| reads, drafts, previews | low | ✅ | ✅ | ✅ |
| file/automation/dashboard edits | approval | ❌ | approval | approval |
| service calls (lights, switches) | high | ❌ | approval | approval |
| locks/alarms/climate/covers | critical | ❌ | approval | approval |
| restart Core | high | ❌ | approval | approval |
| restore backup, auth/network changes | critical | ❌ | approval | approval |

Approvals: 10-min TTL, single-use, tool+args bound, full audit. Bypass attempts (shell/MCP/REST/file) all funnel through `ToolGateway.exec` — there is no second route.
