import { build } from "esbuild-wasm";

// WASM keeps amd64/aarch64 builds portable without native modules.
await build({
  entryPoints: ["ui/app.tsx"],
  bundle: true,
  outdir: "public/build",
  entryNames: "app",
  minify: true,
  target: ["es2022"],
  format: "esm",
  tsconfig: "tsconfig.ui.json",
  define: { "process.env.NODE_ENV": '"production"' },
  legalComments: "linked",
});
