# SECURITY.md

- Default `observe` (read-only). No silent mutation; approvals are TTL + single-use + tool-bound + audited.
- Single choke point: `ToolGateway.exec`. No shell/MCP/REST/file bypass exists by construction.
- Ingress session auth; no extra open ports by default; tokens never logged (redaction at boundary).
- Allowlisted FS access; `.storage`, DBs, Supervisor-managed files never written directly.
- Untrusted content (logs, web, repo files) is data, never instructions; tool results cannot mint approvals.
- Known limits: host-root ops unsupported; integration flows needing physical action are guided; Codex adapter experimental.
