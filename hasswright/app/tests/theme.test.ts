import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  connectHomeAssistantTheme,
  isDarkColor,
  type ThemeState,
} from "../ui/theme.js";

describe("HA theme bridge", () => {
  it("detects light/dark HA colors independently of OS preference", () => {
    for (const color of [
      "#111",
      "#111111",
      "rgb(28, 28, 28)",
      "rgb(28 28 28 / 1)",
    ])
      assert.equal(isDarkColor(color), true);
    for (const color of ["#fff", "#fafafa", "rgb(255, 255, 255)"])
      assert.equal(isDarkColor(color), false);
    assert.equal(isDarkColor("unknown"), undefined);
  });

  it("syncs only allowlisted HA presentation variables, updates live, and cleans up", () => {
    const fixture = themeEnvironment();
    fixture.parentValues.set("--primary-background-color", "#111111");
    fixture.parentValues.set("--primary-color", "#ff9800");
    fixture.parentValues.set("--ha-card-border-radius", "24px");
    fixture.parentValues.set("--supervisor-token", "private-test-value");
    const states: ThemeState[] = [];
    try {
      const dispose = connectHomeAssistantTheme((state) => states.push(state));
      assert.deepEqual(states.at(-1), {
        source: "Home Assistant",
        mode: "dark",
      });
      assert.equal(fixture.values.get("--hw-ha-primary-color"), "#ff9800");
      assert.equal(fixture.values.get("--hw-ha-ha-card-border-radius"), "24px");
      assert.equal(
        [...fixture.values.values()].includes("private-test-value"),
        false,
      );
      fixture.parentValues.set("--primary-background-color", "#ffffff");
      fixture.parentValues.set("--primary-color", "#673ab7");
      fixture.parentValues.delete("--ha-card-border-radius");
      fixture.tick();
      assert.deepEqual(states.at(-1), {
        source: "Home Assistant",
        mode: "light",
      });
      assert.equal(fixture.values.get("--hw-ha-primary-color"), "#673ab7");
      assert.equal(fixture.values.has("--hw-ha-ha-card-border-radius"), false);
      fixture.parentValues.set("--primary-color", "#03a9f4");
      fixture.tick();
      assert.equal(fixture.values.get("--hw-ha-primary-color"), "#03a9f4");
      assert.equal(
        states.length,
        2,
        "color-only updates do not need React rerenders",
      );
      fixture.parentValues.clear();
      fixture.tick();
      assert.deepEqual(states.at(-1), { source: "System", mode: "light" });
      assert.equal(fixture.values.size, 0, "theme removal restores defaults");
      dispose();
      assert.equal(fixture.values.size, 0);
      assert.equal(fixture.listeners.size, 0);
      assert.equal(fixture.timerCleared(), true);
    } finally {
      fixture.restore();
    }
  });

  it("handles an inaccessible parent frame with a live system fallback", () => {
    const fixture = themeEnvironment();
    const states: ThemeState[] = [];
    try {
      fixture.blockParent();
      const dispose = connectHomeAssistantTheme((state) => states.push(state));
      assert.deepEqual(states.at(-1), { source: "System", mode: "light" });
      fixture.system.matches = true;
      fixture.tick();
      assert.deepEqual(states.at(-1), { source: "System", mode: "dark" });
      assert.equal(fixture.values.size, 0);
      dispose();
    } finally {
      fixture.restore();
    }
  });

  it("reuses already-loaded HA fonts without requesting external fonts", () => {
    const fixture = themeEnvironment();
    fixture.parentValues.set("--primary-background-color", "#ffffff");
    fixture.parentValues.set(
      "--primary-font-family",
      '"HA Custom", sans-serif',
    );
    const loaded = { family: "HA Custom", status: "loaded" } as FontFace;
    const unloaded = { family: "HA Custom", status: "unloaded" } as FontFace;
    const unrelated = { family: "Other", status: "loaded" } as FontFace;
    fixture.parentFonts.add(loaded);
    fixture.parentFonts.add(unloaded);
    fixture.parentFonts.add(unrelated);
    try {
      const dispose = connectHomeAssistantTheme(() => {});
      assert.deepEqual([...fixture.fonts], [loaded]);
      dispose();
      assert.equal(fixture.fonts.size, 0);
    } finally {
      fixture.restore();
    }
  });
});

function themeEnvironment() {
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const priorDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const values = new Map<string, string>();
  const parentValues = new Map<string, string>();
  const listeners = new Map<string, unknown>();
  const fonts = new Set<FontFace>();
  const parentFonts = new Set<FontFace>();
  let tick = () => {};
  let timerCleared = false;
  const system = {
    matches: false,
    addEventListener: (name: string, listener: unknown) =>
      listeners.set(`system:${name}`, listener),
    removeEventListener: (name: string) => listeners.delete(`system:${name}`),
  };
  const parent = {
    getComputedStyle: (element: { style?: { color: string } }) => ({
      getPropertyValue: (name: string) => parentValues.get(name) || "",
      color: element.style?.color || "",
      colorScheme: "normal",
    }),
    document: {
      fonts: parentFonts,
      createElement: () => ({
        style: { color: "", colorScheme: "" },
        hidden: false,
        remove() {},
      }),
      body: { append() {} },
    },
  };
  const fakeWindow = {
    parent,
    frameElement: {},
    matchMedia: () => system,
    setInterval: (fn: () => void) => {
      tick = fn;
      return 1;
    },
    clearInterval: () => {
      timerCleared = true;
    },
    addEventListener: (name: string, listener: unknown) =>
      listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name),
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fakeWindow,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      fonts,
      documentElement: {
        style: {
          setProperty: (name: string, value: string) => values.set(name, value),
          removeProperty: (name: string) => values.delete(name),
        },
      },
    },
  });
  return {
    values,
    parentValues,
    listeners,
    system,
    fonts,
    parentFonts,
    tick: () => tick(),
    timerCleared: () => timerCleared,
    blockParent: () =>
      Object.defineProperty(fakeWindow, "frameElement", {
        get() {
          throw new Error("cross-origin");
        },
      }),
    restore: () => {
      if (priorWindow) Object.defineProperty(globalThis, "window", priorWindow);
      else Reflect.deleteProperty(globalThis, "window");
      if (priorDocument)
        Object.defineProperty(globalThis, "document", priorDocument);
      else Reflect.deleteProperty(globalThis, "document");
    },
  };
}
