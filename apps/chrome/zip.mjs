/** zip.mjs — Gera polypus-chrome.zip para Chrome Web Store.
 *
 *  Monta um diretório temporário com a estrutura exata que o Chrome espera,
 *  depois usa PowerShell para criar o ZIP (sem deps externas).
 *
 *  Uso:  node zip.mjs
 *  Pré:  npm run package (gera dist/ com manifest + icons)
 */
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;

// ── 1. Stage directory ──
const stage = join(tmpdir(), "polypus-build-" + randomUUID().slice(0, 8));
mkdirSync(stage, { recursive: true });

try {
  // ── 2. Copy dist/ (has manifest.json, icons, JS bundles) ──
  const distDir = join(ROOT, "dist");
  if (!existsSync(distDir)) {
    console.error("dist/ not found. Run `npm run package` first.");
    process.exit(1);
  }
  for (const f of readdirSync(distDir)) {
    const src = join(distDir, f);
    const dst = join(stage, f);
    statSync(src).isDirectory() ? cpSync(src, dst, { recursive: true }) : cpSync(src, dst);
  }

  // ── 3. Copy popup/ and sidepanel/ (HTML files) ──
  for (const dir of ["popup", "sidepanel"]) {
    const srcDir = join(ROOT, dir);
    if (existsSync(srcDir)) {
      cpSync(srcDir, join(stage, dir), { recursive: true });
    }
  }

  // ── 4. Verify manifest.json is at root of stage ──
  if (!existsSync(join(stage, "manifest.json"))) {
    console.error("manifest.json missing from staging dir!");
    process.exit(1);
  }

  // ── 5. ZIP it ──
  const zipPath = join(ROOT, "polypus-chrome.zip");
  if (existsSync(zipPath)) rmSync(zipPath);

  // Use PowerShell's built-in Compress-Archive (available on Windows 10+)
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${stage}\\*' -DestinationPath '${zipPath}' -Force"`,
    { stdio: "pipe", shell: true },
  );

  const size = statSync(zipPath).size;
  const fileCount = readdirSync(stage, { recursive: true }).length;
  console.log(`✓ ${zipPath} (${size} bytes, ${fileCount} files)`);
} finally {
  // Cleanup
  if (existsSync(stage)) rmSync(stage, { recursive: true, force: true });
}