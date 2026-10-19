# DEVELOPMENT.md / TESTING.md / RECOVERY.md

## Dev
- `cd hasswright/app && npm install && npm run build && npm test`
- Node ≥22. No native deps. Astryx/React UI source lives in `ui/`; `npm run build`
  type-checks it and bundles local JS/CSS into `public/build/` using esbuild WASM.
  Run the build before starting the server; `npm run build:ui` in `hasswright/app`
  rebuilds only the UI. Generated assets are ignored by git and built in Docker.
- No runtime CDNs or external fonts are needed. Package versions and both root/app
  lockfiles are committed; the app lockfile supports standalone Docker installs.

## Appearance
- In same-origin HA Ingress, the UI reads an allowlist of presentation variables
  from its iframe element, including variables inherited through HA shadow roots.
  Astryx tokens map to HA backgrounds, text, primary color, sidebar colors, fonts,
  card borders, radius, and shadow. Active theme changes sync within one second.
  Already-loaded HA font faces are reused in the iframe without external font requests.
- Direct or cross-origin embeds follow the system color scheme with HA-like defaults.
  No HA credentials, internal connection objects, or theme settings are modified.
- Manually verify light/dark/custom HA themes, live theme switching, mobile
  navigation, chat/session switching, entity dependencies, and approval review.

## Testing
- `npm test` compiles `src/**` + `tests/**` to `dist-tests/` and runs `node:test`.
- Suites: risk/policy, approvals lifecycle, path restrictions, gateway allow/deny, injection resistance, context indexing, demo-fixture gating.
- Integration: HA/Supervisor calls run against mocks; live-API paths covered by typed clients + error mapping.
- Security: observe-mode mutation denial, approval single-use/expiry, traversal/`.storage` denial, secret redaction, prompt-injection non-escalation.
- On-device (HAOS) validation is manual: install, sidebar open, chat, overview, approval flow, change verify, restart persistence.

## Recovery
- Every file mutation takes a snapshot first; `rollbackFiles(snapshotId)` restores.
- Validation failure auto-rolls back. Backup API for full backups before risky ops.
- Change states surfaced in Changes view; `recovery_required` when partial.

## Release and support checks

- Run `npm run check:packaging` from the repository root. Config/app/lockfile versions
  must match; tag releases must match `v<config version>`. Both lockfiles are used:
  root CI uses the workspace lock; Docker uses the standalone app lock.
- CI also calls `containers.yml`: native amd64/aarch64 builds must start, serve real
  bundles, and preserve a session across container replacement using the same data mount.
- `release.yml` publishes architecture images only after smoke tests, then creates the
  versioned multi-arch manifest. Make packages public and verify anonymous pulls before
  setting config's `image` reference. This revision continues source builds.
- Docker's build stage compiles architecture-independent JS/CSS on the build host. The
  runtime has Node and built files only; no npm, compiler, or node_modules is copied.
- Collect Supervisor build logs, app startup logs, installed/available versions, CPU
  architecture and HAOS version when an update fails. Do not remove `/data` to retry.
- See `INSTALL-UPDATE-AUDIT.md` for the audit scope, remaining risks and HAOS checklist.
