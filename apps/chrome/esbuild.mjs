/**
 * Build script for the Polypus Chrome extension.
 * Bundles:
 *   - dist/background.js   (service worker)
 *   - dist/content.js      (content script)
 *   - popup/index.html     (popup UI, with inline JS/CSS)
 *   - sidepanel/index.html (side panel UI)
 *
 * Usage:  node esbuild.mjs [--watch]
 */
import * as esbuild from "esbuild";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "src");
const DIST = join(__dirname, "dist");
const watch = process.argv.includes("--watch");

/** Bundle a single entry point for the web (JSX → JS). */
async function bundle(outfile, entry) {
  const ctx = await esbuild.context({
    entryPoints: [join(SRC, entry)],
    outfile: join(DIST, outfile),
    bundle: true,
    platform: "browser",
    target: "es2022",
    format: "iife",
    sourcemap: watch ? "inline" : false,
    minify: !watch,
    jsx: "automatic",
    loader: { ".tsx": "tsx", ".ts": "ts" },
  });
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

/** Render a simple HTML page with an inline <script> and <style>. */
function renderHtml(title, jsBundle, css = "") {
  const scriptSrc = `../dist/${jsBundle}`;
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;background:#1a1a2e;color:#e0e0e0}
    #root{width:100%;height:100%}
    ${css}
  </style>
</head>
<body><div id="root"></div><script src="${scriptSrc}"></script></body>
</html>`;
}

async function main() {
  if (!existsSync(DIST)) mkdirSync(DIST, { recursive: true });

  // 1. Bundle background service worker
  await bundle("background.js", "background/index.ts");

  // 2. Bundle content script
  await bundle("content.js", "content/index.ts");

  // 3. Bundle popup UI
  await bundle("popup.js", "popup/main.tsx");
  const popupDir = join(__dirname, "popup");
  if (!existsSync(popupDir)) mkdirSync(popupDir, { recursive: true });
  const popupHtml = renderHtml("Polypus", "popup.js");
  writeFileSync(join(popupDir, "index.html"), popupHtml, "utf8");

  // 4. Bundle side panel UI
  await bundle("sidepanel.js", "sidepanel/main.tsx");
  const sideDir = join(__dirname, "sidepanel");
  if (!existsSync(sideDir)) mkdirSync(sideDir, { recursive: true });
  const sideHtml = renderHtml("Polypus — Chat", "sidepanel.js");
  writeFileSync(join(sideDir, "index.html"), sideHtml, "utf8");

  // 5. Copy icons (generate PNG placeholders from SVG)
  const iconDir = join(__dirname, "icons");
  if (!existsSync(iconDir)) mkdirSync(iconDir, { recursive: true });
  // Generate minimal PNG files (1-pixel transparent) as placeholders
  // Real icons will be added later — for now the manifest works with these.
  for (const size of ["16", "48", "128"]) {
    const p = join(iconDir, `${size}.png`);
    if (!existsSync(p)) {
      // Write a minimal valid PNG (1x1 transparent pixel) as placeholder
      const minimalPng = Buffer.from([
        0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A, // PNG signature
        0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52, // IHDR chunk
        0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01, // 1x1
        0x08,0x06,0x00,0x00,0x00,0x1F,0x15,0xC4, // RGBA, 8-bit
        0x89,0x00,0x00,0x00,0x0A,0x49,0x44,0x41, // IDAT chunk
        0x54,0x78,0x9C,0x62,0x00,0x00,0x00,0x02,0x00,0x01,0xE5,0x27,0xDE,0xFC, // compressed data
        0x00,0x00,0x00,0x00,0x49,0x45,0x4E,0x44,0xAE,0x42,0x60,0x82 // IEND
      ]);
      writeFileSync(p, minimalPng);
    }
  }

  console.log(`✓ Chrome extension built → ${DIST}`);
  console.log(`  popup/index.html · sidepanel/index.html`);
  console.log(`  dist/background.js · dist/content.js`);
  console.log(`  dist/popup.js · dist/sidepanel.js`);
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});