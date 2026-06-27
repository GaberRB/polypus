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
  // `vscode` is provided by the host; `@gaberrb/polypus` is the CLI we spawn and
  // resolve at runtime — never bundle it.
  external: ["vscode", "@gaberrb/polypus"],
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

if (watch) {
  const ctxE = await esbuild.context(extension);
  const ctxW = await esbuild.context(webview);
  await Promise.all([ctxE.watch(), ctxW.watch()]);
  console.log("esbuild: watching…");
} else {
  await Promise.all([esbuild.build(extension), esbuild.build(webview)]);
  console.log("esbuild: build complete");
}
