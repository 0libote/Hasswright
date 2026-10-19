import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { configFromEnvironment } from "../src/config.js";
import { homeAssistantWebSocketUrl } from "../src/ha/core.js";
import { Supervisor } from "../src/ha/supervisor.js";
import { Store } from "../src/storage.js";
import { createServer, isIngressPeer } from "../src/server.js";

function temp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "hasswright-lifecycle-"));
}

describe("installation configuration", () => {
  it("routes Supervisor credentials through the official Core proxy without SUPERVISOR_HOST", () => {
    const cfg = configFromEnvironment({ SUPERVISOR_TOKEN: "test-only" });
    assert.equal(cfg.haBaseUrl, "http://supervisor/core");
    assert.equal(cfg.dataDir, "/data");
    assert.equal(cfg.demo, false);
    assert.equal(cfg.mode, "observe");
    assert.equal(
      configFromEnvironment({ HASSIO_TOKEN: "test-only" }).haBaseUrl,
      "http://supervisor/core",
    );
  });
  it("honors direct HA configuration and rejects invalid ports/modes", () => {
    assert.equal(
      configFromEnvironment({
        HA_BASE_URL: "http://example.test:8123",
        HA_TOKEN: "test-only",
      }).haBaseUrl,
      "http://example.test:8123",
    );
    assert.equal(configFromEnvironment({}, { mode: "assist" }).mode, "assist");
    assert.throws(() => configFromEnvironment({ PORT: "NaN" }), /port/);
    assert.throws(() => configFromEnvironment({ PORT: "65536" }), /port/);
    assert.throws(() => configFromEnvironment({}, { mode: "invalid" }), /mode/);
  });
  it("selects the correct direct and Supervisor WebSocket endpoints", () => {
    assert.equal(
      homeAssistantWebSocketUrl("http://supervisor/core"),
      "ws://supervisor/core/websocket",
    );
    assert.equal(
      homeAssistantWebSocketUrl("http://supervisor/core/"),
      "ws://supervisor/core/websocket",
    );
    assert.equal(
      homeAssistantWebSocketUrl("https://ha.example.test"),
      "wss://ha.example.test/api/websocket",
    );
  });
});

describe("update detection", () => {
  it("queries self instead of guessing the repository-prefixed slug", async () => {
    const calls: string[] = [];
    const stub = mock.method(
      globalThis,
      "fetch",
      async (url: string | URL | Request, init?: RequestInit) => {
        calls.push(String(url));
        assert.ok(init?.signal);
        return Response.json({
          result: "ok",
          data: {
            slug: "12345678_hasswright",
            version: "0.1.6",
            version_latest: "0.1.7",
            update_available: true,
          },
        });
      },
    );
    try {
      const result = await new Supervisor(
        "http://supervisor",
        "test-only",
      ).hasswrightUpdate();
      assert.deepEqual(calls, ["http://supervisor/addons/self/info"]);
      assert.equal(result?.slug, "12345678_hasswright");
      assert.equal(result?.updateAvailable, true);
    } finally {
      stub.mock.restore();
    }
  });
  it("reports unknown when disconnected rather than claiming up to date", async () => {
    const stub = mock.method(globalThis, "fetch", async () => {
      throw new Error("offline");
    });
    try {
      assert.equal(
        await new Supervisor(
          "http://supervisor",
          "test-only",
        ).hasswrightUpdate(),
        null,
      );
      assert.equal(
        await new Supervisor("http://supervisor", "").hasswrightUpdate(),
        null,
      );
    } finally {
      stub.mock.restore();
    }
  });
});

describe("upgrade persistence", () => {
  it("preserves sessions, settings, approvals, audit and snapshots after reopening the store", () => {
    const dir = temp();
    try {
      const store = new Store(dir);
      store.putSession({
        id: "s",
        title: "Keep me",
        createdAt: 1,
        updatedAt: 1,
        messages: [],
      });
      store.putSettings({ mode: "observe" });
      store.putApproval({
        id: "a",
        tool: "ha.call_service",
        args: {},
        risk: "high",
        status: "pending",
        createdAt: 1,
        expiresAt: 2,
      });
      store.audit({ ts: 1, actor: "user", action: "example", result: "ok" });
      store.putSnapshot({
        id: "snap",
        ts: 1,
        label: "Keep snapshot",
        files: {},
      });
      const reopened = new Store(dir);
      assert.equal(reopened.getSession("s")?.title, "Keep me");
      assert.deepEqual(reopened.getSettings(), { mode: "observe" });
      assert.equal(reopened.getApproval("a")?.status, "pending");
      assert.equal(reopened.listAudit().length, 1);
      assert.equal(reopened.getSnapshot("snap")?.label, "Keep snapshot");
      assert.equal(
        fs.statSync(path.join(dir, "hasswright.json")).mode & 0o777,
        0o600,
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  it("refuses corrupt or incompatible stores without overwriting the original bytes", () => {
    const dir = temp();
    try {
      const file = path.join(dir, "hasswright.json");
      for (const content of [
        "{broken",
        "null",
        '{"sessions":[]}',
        '{"audit":{}}',
      ]) {
        fs.writeFileSync(file, content);
        assert.throws(() => new Store(dir), /Cannot load persisted/);
        assert.equal(fs.readFileSync(file, "utf8"), content);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("packaged HTTP startup", () => {
  it("accepts only the documented Ingress proxy address, not forwarding-header claims", () => {
    assert.equal(isIngressPeer("172.30.32.2"), true);
    assert.equal(isIngressPeer("::ffff:172.30.32.2"), true);
    assert.equal(isIngressPeer("127.0.0.1"), false);
    assert.equal(isIngressPeer(undefined), false);
  });
  it("denies direct access to a Supervisor-configured app even with a spoofed Ingress header", async () => {
    const dir = temp();
    try {
      fs.mkdirSync(path.join(dir, "build"));
      for (const file of ["index.html", "build/app.js", "build/app.css"])
        fs.writeFileSync(path.join(dir, file), "test");
      const config = configFromEnvironment({
        SUPERVISOR_TOKEN: "test-only",
        HASSWRIGHT_DATA_DIR: path.join(dir, "data"),
      });
      const server = createServer({ publicDir: dir, config });
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      try {
        assert.equal((await fetch(`${base}/api/health`)).status, 200);
        assert.equal(
          (
            await fetch(`${base}/api/sessions`, {
              headers: { "X-Ingress-Path": "/forged" },
            })
          ).status,
          403,
        );
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  it("fails before reporting healthy when UI assets are missing", () => {
    const dir = temp();
    try {
      assert.throws(
        () =>
          createServer({
            publicDir: dir,
            config: configFromEnvironment({ HASSWRIGHT_DATA_DIR: dir }),
          }),
        /WebUI asset missing/,
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  it("serves assets, returns 404 for missing bundles, and keeps sessions across server replacement", async () => {
    const dir = temp();
    const publicDir = path.join(dir, "public");
    fs.mkdirSync(path.join(publicDir, "build"), { recursive: true });
    fs.writeFileSync(
      path.join(publicDir, "index.html"),
      "<html>Hasswright</html>",
    );
    fs.writeFileSync(path.join(publicDir, "build/app.js"), "/* bundle */");
    fs.writeFileSync(path.join(publicDir, "build/app.css"), "body{}");
    const config = configFromEnvironment({
      HASSWRIGHT_DATA_DIR: path.join(dir, "data"),
    });
    const start = async () => {
      const server = createServer({ publicDir, config });
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      return {
        server,
        base: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
      };
    };
    let running = await start();
    try {
      const health = (await (
        await fetch(`${running.base}/api/health`)
      ).json()) as { ok: boolean };
      assert.equal(health.ok, true);
      const bundle = await fetch(`${running.base}/build/app.js`);
      assert.equal(bundle.headers.get("content-type"), "text/javascript");
      assert.equal(bundle.headers.get("cache-control"), "no-cache");
      assert.equal(
        (await fetch(`${running.base}/build/missing.js`)).status,
        404,
      );
      assert.equal(
        (await fetch(`${running.base}/`)).headers.get("cache-control"),
        "no-store",
      );
      const created = (await (
        await fetch(`${running.base}/api/sessions`, {
          method: "POST",
          body: "{}",
        })
      ).json()) as { session: { id: string } };
      await new Promise<void>((resolve) =>
        running.server.close(() => resolve()),
      );
      running = await start();
      const persisted = (await (
        await fetch(`${running.base}/api/sessions/${created.session.id}`)
      ).json()) as { session: { id: string } };
      assert.equal(persisted.session.id, created.session.id);
    } finally {
      await new Promise<void>((resolve) =>
        running.server.close(() => resolve()),
      );
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
