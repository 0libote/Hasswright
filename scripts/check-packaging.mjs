import fs from "node:fs";
import assert from "node:assert/strict";
import * as yaml from "js-yaml";

const read = (file) => fs.readFileSync(file, "utf8");
const config = yaml.load(read("hasswright/config.yaml"));
// Supported Supervisor fields used by this add-on. See the linked schema reference.
// https://contributors.home-assistant.io/apps/reference/configuration/
const keys = new Set([
  "name",
  "version",
  "slug",
  "description",
  "url",
  "arch",
  "init",
  "startup",
  "boot",
  "stage",
  "ports",
  "ingress",
  "ingress_port",
  "panel_title",
  "panel_icon",
  "homeassistant_api",
  "hassio_api",
  "hassio_role",
  "auth_api",
  "map",
  "options",
  "schema",
  "environment",
  "watchdog",
  "backup",
  "backup_exclude",
  "timeout",
  "image",
]);
for (const key of Object.keys(config))
  assert.ok(keys.has(key), `Unsupported packaging key: ${key}`);
for (const key of ["name", "version", "slug", "description"])
  assert.equal(typeof config[key], "string", key);
assert.match(config.version, /^\d+\.\d+\.\d+$/);
assert.deepEqual([...config.arch].sort(), ["aarch64", "amd64"]);
assert.equal(config.ingress, true);
assert.equal(config.ingress_port, 8099);
assert.equal(config.init, false, "HA base images supply s6 init");
assert.equal(config.options.mode, "observe");
assert.equal(config.schema.mode, "list(observe|assist|managed)");
assert.equal(config.environment.HASSWRIGHT_DATA_DIR, "/data");
assert.ok(config.timeout >= 10 && config.timeout <= 300);
assert.ok(
  ["default", "homeassistant", "backup", "manager", "admin"].includes(
    config.hassio_role,
  ),
);
for (const mount of config.map) {
  assert.ok(
    ["homeassistant_config", "backup", "share", "ssl", "data"].includes(
      mount.type,
    ),
  );
  if (mount.read_only !== undefined)
    assert.equal(typeof mount.read_only, "boolean");
}
for (const file of [
  "hasswright/app/package.json",
  "hasswright/app/package-lock.json",
])
  assert.equal(JSON.parse(read(file)).version, config.version, file);
assert.equal(
  JSON.parse(read("package-lock.json")).packages["hasswright/app"].version,
  config.version,
);
if (process.env.RELEASE_TAG)
  assert.equal(
    process.env.RELEASE_TAG,
    `v${config.version}`,
    "Release tag must match the version Supervisor installs",
  );
for (const file of [
  "hasswright/build.yaml",
  "repository.yaml",
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  ".github/workflows/containers.yml",
])
  yaml.load(read(file));
const dockerfile = read("hasswright/Dockerfile");
assert.ok(
  dockerfile.includes("FROM --platform=$BUILDPLATFORM node:22-alpine AS build"),
);
assert.ok(dockerfile.includes("COPY --from=build /build/public ./public"));
assert.ok(!/COPY app\/(dist|node_modules)/.test(dockerfile));
console.log(
  `Packaging validated: Hasswright ${config.version}, amd64 + aarch64, observe by default`,
);
if (!config.image)
  console.log(
    "Delivery: source builds. Activate prebuilt image only after its versioned public manifest is verified.",
  );
