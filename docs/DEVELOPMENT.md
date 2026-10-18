# DEVELOPMENT.md / TESTING.md / RECOVERY.md

## Dev
- `cd hasswright/app && npm install && npm run build && npm test`
- Node ≥22. No native deps. UI is static (`public/`), no bundler.

## Testing
- `npm test` compiles `src/**` + `tests/**` to `dist-tests/` and runs `node:test`.
- Suites: risk/policy, approvals lifecycle, path restrictions, gateway allow/deny, injection resistance, context indexing.
- Integration: HA/Supervisor calls run against mocks; live-API paths covered by typed clients + error mapping.
- Security: observe-mode mutation denial, approval single-use/expiry, traversal/`.storage` denial, secret redaction, prompt-injection non-escalation.
- On-device (HAOS) validation is manual: install, sidebar open, chat, overview, approval flow, change verify, restart persistence.

## Recovery
- Every file mutation takes a snapshot first; `rollbackFiles(snapshotId)` restores.
- Validation failure auto-rolls back. Backup API for full backups before risky ops.
- Change states surfaced in Changes view; `recovery_required` when partial.
