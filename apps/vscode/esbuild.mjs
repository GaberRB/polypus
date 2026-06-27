/**
 * Builds two bundles:
 *   dist/extension.js — the host (Node/CommonJS, `vscode` + the spawned CLI
 *                       kept external so require.resolve finds the real files).
 *   dist/webview.js   — the React UI (browser/IIFE, bundles React + chat-ui),
 *                       plus dist/webview.css emitted from the imported styles.
 */
import * as esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const prod = process.argv.includes("--production");

/** @type {import('esbuild').BuildOptions} */
const common = {
  bundle: true,
  sourcemap: !prod,
  minify: prod,
  logLevel: "info",
};

const extension = {
  ...common,
  entryPoints: ["src/extension.ts"],
  outfile: "dist/extension.js",
  platform: "node",
  format: "cjs",
  // `vscode` is provided by the host at runtime — never bundle it.
  external: ["vscode"],
};

const webview = {
  ...common,
  entryPoints: ["src/webview/main.tsx"],
  outfile: "dist/webview.js",
  platform: "browser",
  format: "iife",
  jsx: "automatic",
  loader: { ".css": "css" },
  define: { "process.env.NODE_ENV": prod ? '"production"' : '"development"' },
};

// Self-contained CLI bundle (T6): inline the whole Polypus CLI + its deps into a
// single file shipped in dist/, so the VSIX needs no node_modules at runtime.
// Spawned via VSCode's Node (ELECTRON_RUN_AS_NODE). See host/cli.ts.
const cli = {
  ...common,
  entryPoints: ["../../src/cli/index.ts"],
  outfile: "dist/cli.mjs",
  platform: "node",
  target: "node20",
  format: "esm",
  // ESM-bundle interop: shim require/__dirname for any CJS dep that needs them.
  banner: {
    js: [
      "import { createRequire as __cr } from 'node:module';",
      "import { fileURLToPath as __f } from 'node:url';",
      "import { dirname as __d } from 'node:path';",
      "const require = __cr(import.meta.url);",
      "const __filename = __f(import.meta.url);",
      "const __dirname = __d(__filename);",
    ].join("\n"),
  },
};

if (watch) {
  const ctxs = await Promise.all([esbuild.context(extension), esbuild.context(webview), esbuild.context(cli)]);
  await Promise.all(ctxs.map((c) => c.watch()));
  console.log("esbuild: watching…");
} else {
  await Promise.all([esbuild.build(extension), esbuild.build(webview), esbuild.build(cli)]);
  console.log("esbuild: build complete");
}
