# SECURITY.md

- Default `observe` (read-only). No silent mutation; approvals are TTL + single-use + bound to the tool and exact arguments + audited.
- Hasswright tool calls pass through `ToolGateway.exec`; external providers require separate permission review.
- Supervisor-backed deployments restrict UI/API peers to the Ingress proxy; no extra open ports by default; tokens never logged (redaction at boundary).
- Filesystem tools use path/extension allowlists and deny `.storage`; real-path/symlink hardening remains open in the audit.
- Untrusted content (logs, web, repo files) is data, never instructions; tool results cannot mint approvals.
- Known limits: host-root ops unsupported; integration flows needing physical action are guided; Codex adapter experimental.

Known gaps in the mutation pipeline, path resolution, standalone access and provider
lifecycle are recorded in [the audit](docs/INSTALL-UPDATE-AUDIT.md). The complete
apply/validate/rollback sequence must be verified before production write-capable use.
