# Install, update, and support audit — 2026-10-19

Scope: repository discovery, version metadata, source/container builds, release delivery,
startup, HA/Supervisor connectivity, persistent data, update reporting, Ingress access,
and the UI paths involved in investigating an installation. Policy and provider code
were also reviewed for issues that affect safe operation after an update.

No failing on-device installation log was supplied. These are code-backed findings,
not a claim to have reproduced a particular user's HAOS failure.

## Changes in this revision

| Finding | Effect | Change and evidence |
| --- | --- | --- |
| Release workflow only echoed a placeholder; config has no `image` | Every install/update compiles on the HA device; green CI did not prove a container boots | Real architecture build/smoke jobs and a versioned GHCR release workflow are prepared. Publication and native Docker execution still need to run in GitHub Actions. |
| Docker's default base was specifically aarch64; runtime retained build dependencies | Direct default builds could select the wrong architecture; larger installed image | Build stage runs on `$BUILDPLATFORM`; runtime uses the supported multi-arch HA base. Only Node, backend output, bundled UI, and package metadata enter runtime. `build.yaml` remains for older Supervisor versions. |
| Supervisor credentials selected the direct HA URL unless `SUPERVISOR_HOST` existed | Installed app could boot but fail to read HA | Token presence selects `http://supervisor/core`. Explicit `HA_BASE_URL` still wins. Configuration regression tests cover both. |
| WebSocket URL appended `/api/websocket` to the Supervisor proxy | Registries and other WS data failed | Supervisor proxy uses `/core/websocket`; direct HA uses `/api/websocket`. URLs, auth rejection, and close/timeout cleanup were reviewed. URL regression tests added. |
| Update lookup guessed the repository-prefixed slug; requests lacked deadlines | Update information could remain missing or hang | Read `/addons/self/info` first, retain a fallback, bound requests, and distinguish unknown from up-to-date in UI. Mocked Supervisor tests added. |
| Static serving depended on the launch working directory | Starting from the repository root could return a broken UI | Resolve assets relative to the server module. Root-directory startup checked manually. |
| Health succeeded with missing UI bundles; missing JS returned HTML/200 | Supervisor could report a running app with a blank page | Fail startup before listening if required assets are missing. Missing assets return 404; HTML uses no-store and bundles revalidate. HTTP integration tests added. |
| Invalid data JSON was silently replaced with an empty in-memory store | A later save could erase sessions/settings after a failed upgrade or disk issue | Only missing files initialize fresh data. Corrupt/incompatible top-level stores fail closed without changing original bytes. Store files use mode 0600. Reopen and HTTP server-replacement tests preserve data. |
| No centralized version/packaging check or add-on-local changelog | Version drift and poor update diagnostics | Prepared 0.1.7 consistently across config, app, and both lockfiles; packaging checker validates supported keys/types/defaults and tag equality. Added the changelog used by Supervisor. |
| Ingress enforcement was a no-op despite an auth claim in comments | Exposing the optional port bypassed HA's UI authentication | Supervisor-configured deployments only allow the documented Ingress proxy peer. Health remains available for watchdogs. Spoofed header/direct access denial tests added. |
| Backup creation was classified low risk; approval checking ignored arguments | Observe could create backups; approval could be reused for different arguments | Backups require approval and are audited; Observe rejects before requesting approval; approvals bind exact arguments and remain single-use. Allow/deny tests added. |
| Failed inventory reads returned zeros without explanation | UI suggested an empty installation instead of a connection failure | Inventory reports configuration/state source availability and safe warnings. Workspace avoids presenting unavailable state counts as known. |
| UI centered conversations, not installation tasks | Health, evidence and review were secondary | Workspace now starts with inventory, attention items, task shortcuts, approvals, update status and audit activity. Assistant opens separately and retains sessions. |

## Release activation and verification still required

1. Run CI container jobs on native amd64 and aarch64 runners. This environment has no
   Docker engine, so a successful local Node build is not a container validation.
2. Run the release workflow for a version matching `config.yaml`. Its architecture
   images are smoke-tested before push, then combined into a versioned manifest.
3. Make GHCR packages public and verify an unauthenticated pull for both platforms.
   Only then add `image: ghcr.io/0libote/hasswright` to config. This revision deliberately
   retains source installation rather than pointing Supervisor at unpublished images.
4. Install on HAOS and upgrade an existing installation; verify Ingress, the actual
   Supervisor peer, Core REST/WS, theme switching, version reporting, persistent sessions,
   failed-upgrade recovery, and user-selected backup behavior.
5. `backup: hot` selects backup behavior while running. It does **not** guarantee an
   automatic backup for every update. Take or select a backup explicitly before updating.

## Remaining implementation risks

These are release blockers for broad write-capable/remote production claims, not
features verified by the new container smoke tests:

- **High — configuration mutation pipeline:** `src/tools/gateway.ts` still contains its
  own file-write path instead of using one complete apply/validate/rollback pipeline.
  Invalid/unknown validation can be reported after a write; template checks and complete
  post-change verification are missing. The optional HA configuration mount is read-only
  as shipped. Do not advertise automation/dashboard apply as production supported until
  a supported API or a tested, targeted YAML pipeline satisfies the project rules.
- **High — restart and indirect service effects:** Core restart lacks the required
  preflight check/recovery/verification sequence. Generic service calls can address
  lifecycle services too. Constrain these through the same operation-specific policy.
- **High — filesystem boundaries:** path allowlists are lexical and do not resolve
  symlinks; `/data` includes policy/session state. Separate tool-readable configuration
  from internal app state, resolve real paths, and add symlink escape tests.
- **Medium — standalone access:** standalone development does not have a login flow.
  Keep it local/trusted. The Ingress peer restriction is enforced for Supervisor-backed
  installations; it does not add standalone remote authentication.
- **Medium — provider lifecycle:** OpenCode local-to-remote session IDs are not persisted,
  outbound chat requests lack deadlines/cancellation, and the external provider's own
  tools/permissions are not governed by Hasswright. Avoid granting a provider independent
  HA write access; add persistent session mapping and a scoped tool protocol.
- **Medium — inventory fidelity:** unavailable registry/repair/trace requests still have
  fallback behavior that can hide missing capabilities. Add per-source completeness,
  verify current supported trace commands, and distinguish unsupported from empty results.
- **Medium — storage evolution:** top-level store validation prevents silent reset but is
  not a versioned migration system or deep record validation. Add schema-versioned,
  backward-compatible migrations, interrupted-write tests and backup/restore exercises
  before changing persisted formats.
- **Medium — resource limits:** cap JSON request size, session/history retention and file
  output sizes; add memory/slow-request tests on a small HA host. Pin base image digests
  and establish scheduled dependency/base-image review.

Keep Observe as the default. Updating the UI and release plumbing does not establish
that the pre-existing mutation implementation meets its documented safety promises.

## Source references

- [HA app communication: Core proxy, WS proxy, and self endpoints](https://developers.home-assistant.io/docs/apps/communication/)
- [HA Ingress peer restriction](https://developers.home-assistant.io/docs/apps/presentation/)
- [HA publishing guidance](https://developers.home-assistant.io/docs/add-ons/publishing/)
- [HA base images and multi-architecture support](https://github.com/home-assistant/docker-base)
- [Supervisor configuration reference](https://developers.home-assistant.io/docs/add-ons/configuration/)

- **Low — optional features are scaffolding:** the custom integration registers an entry
  but exposes no privileged API; its manifest still has a placeholder codeowner. Codex
  is a stub, and the maintenance runner is not wired to a scheduler. Do not treat these
  as installed capabilities. The assistant now labels the built-in example adapter.

## Local verification result

- `npm run build`, `npm test` (34 tests), `npm run lint`, and `npm run check:packaging` pass.
- `actionlint` 1.7.12 accepts the CI, native container and release workflows.
- Production dependency audit reports no known vulnerabilities at audit time.
- The public HA base 3.22 manifest was inspected and contains amd64 and arm64 images.
- Browser checks cover workspace-first navigation, assistant conversation without
  replacing the workspace, and desktop/mobile layouts with no horizontal overflow.
- Native Docker image execution, public Hasswright image pulls, and live HAOS
  installation/update remain unverified here. No images were published or deployed.
