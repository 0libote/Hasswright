# ARCHITECTURE.md

```
Browser (HA sidebar, Ingress)
   │  Ingress session (Supervisor validates)
   ▼
Hasswright Backend (Node 22, :8099)
 ├── routes/api.ts      sessions/chat, context, tools/exec, approvals, audit
 ├── agent/             Adapter interface; opencode.ts (primary), codex.ts (exp), mock
 ├── ha/                core.ts (REST+WS), supervisor.ts, capabilities.ts
 ├── context/engine.ts  inventory, search, dependencies, stale refs, redaction
 ├── tools/             definitions.ts (typed), gateway.ts (single choke point)
 ├── policy/            risk.ts (classify/gate), approvals.ts (TTL+single-use), execution.ts (snapshot/recheck/validate/rollback)
 ├── storage.ts         JSON store in /data (sessions, approvals, audit, snapshots, settings)
 ├── ui/                Astryx/React UI + live HA theme bridge (bundled with esbuild WASM)
 └── public/            static shell/assets + generated build/ (all seven existing views)
```

**Security invariant:** every effectful path (HTTP route, agent tool call, file write, service call) passes
`ToolGateway.exec` → `classify` → `mayExecute` → approval record check. No shell tool is exposed to the model.
File access is allowlisted and traversal-proof; `.storage` denied. Secrets redacted at the boundary.
