// Copy presentation properties only, never HA's auth or connection objects.
export const HA_THEME_PROPERTIES = [
  "primary-color",
  "accent-color",
  "primary-background-color",
  "secondary-background-color",
  "card-background-color",
  "ha-card-background",
  "primary-text-color",
  "secondary-text-color",
  "disabled-text-color",
  "divider-color",
  "ha-card-border-color",
  "ha-card-border-width",
  "ha-card-border-radius",
  "ha-card-box-shadow",
  "primary-font-family",
  "ha-font-family-body",
  "ha-font-family-heading",
  "text-primary-color",
  "error-color",
  "warning-color",
  "success-color",
  "sidebar-background-color",
  "sidebar-text-color",
  "sidebar-selected-text-color",
  "sidebar-selected-icon-color",
] as const;

export function isDarkColor(value: string): boolean | undefined {
  const hex = value.trim().match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  let channels: number[];
  if (hex) {
    const digits =
      hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    channels = [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16));
  } else {
    const rgb = value.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
    if (!rgb) return undefined;
    channels = rgb.slice(1, 4).map(Number);
  }
  return (
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 < 128
  );
}

export type ThemeState = {
  mode: "light" | "dark";
  source: "Home Assistant" | "System";
};

export function connectHomeAssistantTheme(
  onChange: (state: ThemeState) => void,
): () => void {
  const root = document.documentElement;
  const system = window.matchMedia("(prefers-color-scheme: dark)");
  const sharedFonts = new Set<FontFace>();
  let previous = "";
  const sync = () => {
    let source: ThemeState["source"] = "System";
    let dark = system.matches;
    let parentStyle: CSSStyleDeclaration | undefined;
    try {
      // The iframe inherits variables through HA's shadow roots. Ingress is same-origin.
      const frame = window.frameElement;
      if (frame && window.parent !== window) {
        const style = window.parent.getComputedStyle(frame);
        if (style.getPropertyValue("--primary-background-color").trim()) {
          parentStyle = style;
          source = "Home Assistant";
          // Reuse already-loaded HA fonts in this document without loading a CDN.
          const families = [
            "primary-font-family",
            "ha-font-family-body",
            "ha-font-family-heading",
          ]
            .flatMap((name) => style.getPropertyValue(`--${name}`).split(","))
            .map((family) =>
              family
                .trim()
                .replace(/^['"]|['"]$/g, "")
                .toLowerCase(),
            );
          window.parent.document.fonts?.forEach((font) => {
            if (
              font.status === "loaded" &&
              families.includes(
                font.family.replace(/^['"]|['"]$/g, "").toLowerCase(),
              ) &&
              !document.fonts.has(font)
            ) {
              document.fonts.add(font);
              sharedFonts.add(font);
            }
          });
          // Resolve named colors, light-dark(), and other CSS color syntax in-browser.
          const probe = window.parent.document.createElement("span");
          probe.style.color = style.getPropertyValue(
            "--primary-background-color",
          );
          probe.style.colorScheme = style.colorScheme;
          probe.hidden = true;
          window.parent.document.body.append(probe);
          dark =
            isDarkColor(window.parent.getComputedStyle(probe).color) ?? dark;
          probe.remove();
        }
      }
    } catch {
      /* Cross-origin embeds use the system fallback. */
    }
    for (const name of HA_THEME_PROPERTIES) {
      const property = `--hw-ha-${name}`;
      const value = parentStyle?.getPropertyValue(`--${name}`).trim();
      if (value) root.style.setProperty(property, value);
      else root.style.removeProperty(property);
    }
    const state: ThemeState = { mode: dark ? "dark" : "light", source };
    if (JSON.stringify(state) !== previous) {
      previous = JSON.stringify(state);
      onChange(state);
    }
  };
  sync();
  // Also catches stylesheet replacement and theme changes inside shadow roots.
  const timer = window.setInterval(sync, 1000);
  system.addEventListener("change", sync);
  window.addEventListener("focus", sync);
  return () => {
    window.clearInterval(timer);
    system.removeEventListener("change", sync);
    window.removeEventListener("focus", sync);
    HA_THEME_PROPERTIES.forEach((name) =>
      root.style.removeProperty(`--hw-ha-${name}`),
    );
    sharedFonts.forEach((font) => document.fonts.delete(font));
  };
}
