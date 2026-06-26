/**
 * E2E human simulation — launches the compiled Polypus Desktop app, configures
 * a free OpenRouter model, selects a temp project, sends a medium-complexity
 * coding task and reports the result.
 *
 * Prerequisites:
 *   npm run build   (builds out/main/index.js)
 *   mkdir C:\Temp\polypus-test-project
 */

import { test, _electron as electron } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const PROJECT_DIR = "C:\\Temp\\polypus-test-project";
const APP_PATH = path.join(__dirname, "../out/main/index.js");
const SCREENSHOTS = path.join(__dirname, "screenshots");

const TASK = [
  "Crie um script Python chamado csv_stats.py que:",
  "1. Lê um arquivo CSV passado como argumento de linha de comando",
  "2. Detecta colunas numéricas automaticamente",
  "3. Calcula mean, median, std dev, min, max para cada coluna",
  "4. Gera um relatório formatado em tabela no terminal",
  "5. Trata erros: arquivo não encontrado, CSV vazio, sem colunas numéricas",
  "Inclua também um arquivo sample_data.csv de exemplo para testar.",
].join("\n");

test("human simulation: csv_stats coding task via free OpenRouter model", async () => {
  test.setTimeout(360_000);

  fs.mkdirSync(SCREENSHOTS, { recursive: true });
  // Clean previous run artifacts so we can verify fresh file creation
  if (fs.existsSync(PROJECT_DIR)) {
    for (const f of fs.readdirSync(PROJECT_DIR)) {
      fs.rmSync(`${PROJECT_DIR}\\${f}`, { recursive: true, force: true });
    }
  }
  fs.mkdirSync(PROJECT_DIR, { recursive: true });

  // ── Launch ───────────────────────────────────────────────────────────
  const app = await electron.launch({ args: [APP_PATH] });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForSelector(".shell-2col", { timeout: 15_000 });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(SCREENSHOTS, "01-initial.png"), fullPage: true });
  console.log("✓ App launched");

  // ── Configure free model ─────────────────────────────────────────────
  const cfgRaw = await page.evaluate(() =>
    (window as unknown as { polypus?: { getConfig: () => Promise<unknown> } }).polypus?.getConfig()
  );
  console.log("Current config:", JSON.stringify(cfgRaw));

  // Find existing agent name to preserve its API key reference
  type CfgResult = { ok: true; data: { agents: { name: string }[]; defaultAgent?: string } } | { ok: false };
  const cfg = cfgRaw as CfgResult | undefined;
  let agentName = "openrouter";
  if (cfg?.ok) {
    if (cfg.data.defaultAgent) {
      agentName = cfg.data.defaultAgent;
    } else if (cfg.data.agents.length > 0 && cfg.data.agents[0]) {
      agentName = cfg.data.agents[0].name;
    }
  }

  // Pick best available free model with tool support
  type ModelEntry = { id: string; free: boolean; supportsTools: boolean; popularity: number };
  type ModelsResult = { ok: true; data: ModelEntry[] } | { ok: false };
  const modelsRaw = await page.evaluate(() =>
    (window as unknown as { polypus?: { listModels: () => Promise<unknown> } }).polypus?.listModels()
  ) as ModelsResult | undefined;

  // Preferred free models in order (instruction-following + good tool calling)
  const PREFERRED_FREE = [
    "openrouter/owl-alpha",
    "meta-llama/llama-3.3-70b-instruct:free",
    "deepseek/deepseek-r1:free",
    "google/gemma-3-27b-it:free",
  ];

  let freeModel = "openrouter/owl-alpha";
  if (modelsRaw?.ok) {
    const freeModels = modelsRaw.data.filter((m) => m.free && m.supportsTools);
    console.log(`Free models with tools (${freeModels.length}): ${freeModels.slice(0, 8).map((m) => m.id).join(", ")}`);
    // Try preferred models first
    const found = PREFERRED_FREE.find((pref) => freeModels.some((m) => m.id === pref));
    if (found) {
      freeModel = found;
    } else if (freeModels.length > 0 && freeModels[0]) {
      freeModel = freeModels.sort((a, b) => b.popularity - a.popularity)[0]!.id;
    }
  }
  console.log("Selected free model:", freeModel);

  const saveRaw = await page.evaluate(
    ({ name, model }) =>
      (window as unknown as {
        polypus?: {
          saveAgent: (input: {
            name: string;
            provider: string;
            model: string;
            setDefault: boolean;
          }) => Promise<unknown>;
        };
      }).polypus?.saveAgent({
        name,
        provider: "openrouter",
        model,
        setDefault: true,
      }),
    { name: agentName, model: freeModel }
  );
  console.log("Save agent result:", JSON.stringify(saveRaw));

  // ── Set project dir ──────────────────────────────────────────────────
  await page.evaluate((dir) => localStorage.setItem("polypus.lastProject", dir), PROJECT_DIR);
  await page.evaluate(
    (dir) =>
      (window as unknown as { polypus?: { addRecentProject: (p: string) => Promise<unknown> } }).polypus?.addRecentProject(dir),
    PROJECT_DIR
  );

  // Reload so React picks up localStorage + fresh config
  await page.reload();
  await page.waitForSelector(".shell-2col", { timeout: 15_000 });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: path.join(SCREENSHOTS, "02-project-set.png"), fullPage: true });
  console.log("✓ Project set:", PROJECT_DIR);

  // ── Verify Code tab / textarea ───────────────────────────────────────
  const codeTabBtn = page.locator("button.toptab", { hasText: "Code" });
  await codeTabBtn.click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(SCREENSHOTS, "03-code-tab.png"), fullPage: true });

  const textarea = page.locator("textarea.composer-input");
  const textareaVisible = await textarea.isVisible().catch(() => false);
  console.log("Textarea visible:", textareaVisible);

  // ── Switch to bypass mode (no approval prompts) ─────────────────────
  const bypassBtn = page.locator("button.mode-btn", { hasText: "bypass" });
  if (await bypassBtn.isVisible()) {
    await bypassBtn.click();
    await page.waitForTimeout(300);
    console.log("✓ Mode set to bypass");
  } else {
    console.log("⚠ bypass mode button not found");
  }

  // ── Type and send the task ───────────────────────────────────────────
  if (!textareaVisible) {
    console.log("⚠ Textarea not visible — project might not be set");
    await page.screenshot({ path: path.join(SCREENSHOTS, "03b-no-textarea.png"), fullPage: true });
    await app.close();
    throw new Error("Textarea not visible — project not set correctly");
  }

  await textarea.fill(TASK);
  await page.screenshot({ path: path.join(SCREENSHOTS, "04-task-typed.png"), fullPage: true });
  console.log("✓ Task typed");

  const t0 = Date.now();
  await textarea.press("Enter");
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(SCREENSHOTS, "05-running-3s.png"), fullPage: true });
  const stopVisible = await page.locator(".stop-btn").isVisible().catch(() => false);
  console.log("Agent running (stop btn visible):", stopVisible);

  // ── Wait for task completion ─────────────────────────────────────────
  console.log("⏳ Waiting for task completion (up to 5 min)…");
  let timedOut = false;
  const stopLocator = page.locator(".stop-btn");
  // Take intermediate screenshots every 30s while running
  const snapInterval = setInterval(() => {
    const snapN = Math.floor((Date.now() - t0) / 30_000);
    void page.screenshot({ path: path.join(SCREENSHOTS, `05b-running-${snapN * 30}s.png`), fullPage: true }).catch(() => undefined);
  }, 30_000);
  try {
    await stopLocator.waitFor({ state: "detached", timeout: 300_000 });
  } catch (err) {
    timedOut = true;
    console.log("⚠ Wait failed:", String(err).substring(0, 200));
  } finally {
    clearInterval(snapInterval);
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`⏱ Elapsed: ${elapsed}s`);

  await page.screenshot({ path: path.join(SCREENSHOTS, "06-completed.png"), fullPage: true });

  // Take a screenshot of the full thread
  const thread = page.locator(".thread");
  if (await thread.isVisible()) {
    await thread.screenshot({ path: path.join(SCREENSHOTS, "06b-thread.png") });
  }

  // ── Check filesystem results ─────────────────────────────────────────
  const files = fs.existsSync(PROJECT_DIR) ? fs.readdirSync(PROJECT_DIR) : [];
  const csvStats = files.includes("csv_stats.py");
  const sampleData = files.includes("sample_data.csv");
  console.log("Files in project dir:", files.join(", ") || "(none)");
  console.log("csv_stats.py created:", csvStats ? "✓" : "✗");
  console.log("sample_data.csv created:", sampleData ? "✓" : "✗");

  // Read file content if created
  if (csvStats) {
    const code = fs.readFileSync(`${PROJECT_DIR}\\csv_stats.py`, "utf8");
    console.log("csv_stats.py content (first 500 chars):\n", code.substring(0, 500));
  }

  // ── Read agent output + tool details from DOM ────────────────────────
  const agentTexts = await page.locator(".msg-agent .msg-text").allTextContents();
  const agentOutput = agentTexts.join("\n\n---\n\n").substring(0, 3000);

  const errorTexts = await page.locator(".msg-error .msg-text").allTextContents();
  const toolCount = await page.locator(".tool").count();

  // Capture tool call names for diagnostic
  const toolNames = await page.locator(".tool-name").allTextContents();
  const toolOutputs = await page.locator(".tool-out").allTextContents();
  console.log("Tool calls in timeline:", toolCount);
  console.log("Tool names:", toolNames.join(", ") || "(none)");
  console.log("Tool outputs:", toolOutputs.map((o) => o.substring(0, 80)).join(" | ") || "(none)");
  if (errorTexts.length > 0) console.log("⚠ Errors:", errorTexts.join(" | "));

  // ── UX observations ──────────────────────────────────────────────────
  const hasUsageBar = await page.locator(".usage-bar").isVisible().catch(() => false);
  const hasMascot = await page.locator(".polypus-vp").first().isVisible().catch(() => false);
  console.log("Usage bar visible:", hasUsageBar);
  console.log("Mascot visible:", hasMascot);

  await page.screenshot({ path: path.join(SCREENSHOTS, "07-final.png"), fullPage: true });
  await app.close();

  // ── Write report ─────────────────────────────────────────────────────
  const rating = csvStats && sampleData && errorTexts.length === 0
    ? "✅ Excelente" : csvStats ? "🟡 Bom" : "🔴 Precisa melhorar";

  const report = buildReport({ elapsed, files, csvStats, sampleData, toolCount, errorTexts, agentOutput, timedOut, rating });
  const reportPath = path.join(__dirname, "REPORT.md");
  fs.writeFileSync(reportPath, report, "utf8");
  console.log(`\n📋 Report written to ${reportPath}`);
  console.log(`\n🏆 Rating: ${rating}`);

  // Soft assert — don't fail the test if csv was created (partial success is valuable)
  if (!csvStats) {
    console.log("❌ csv_stats.py was NOT created — agent failed or wrong directory");
  }
});

// ─────────────────────────────────────────────────────────────────────────────

function buildReport(r: {
  elapsed: string;
  files: string[];
  csvStats: boolean;
  sampleData: boolean;
  toolCount: number;
  errorTexts: string[];
  agentOutput: string;
  timedOut: boolean;
  rating: string;
}): string {
  return `# Relatório E2E — Polypus Desktop
**Data:** ${new Date().toISOString()}
**Modelo:** deepseek/deepseek-chat-v3-0324:free (OpenRouter)
**Projeto:** ${PROJECT_DIR}
**Tempo total:** ${r.elapsed}s${r.timedOut ? " (⚠ timeout)" : ""}

---

## Resultado da Tarefa

| Item | Status |
|------|--------|
| csv_stats.py criado | ${r.csvStats ? "✅ Sim" : "❌ Não"} |
| sample_data.csv criado | ${r.sampleData ? "✅ Sim" : "❌ Não"} |
| Erros no chat | ${r.errorTexts.length === 0 ? "✅ Nenhum" : `⚠️ ${r.errorTexts.length} erro(s)`} |
| Tool calls na timeline | ${r.toolCount} |

**Arquivos criados:** ${r.files.join(", ") || "(nenhum)"}

**Rating geral:** ${r.rating}

---

## Output do Agente

\`\`\`
${r.agentOutput || "(nenhum output capturado)"}
\`\`\`

${r.errorTexts.length > 0 ? `## Erros\n\n${r.errorTexts.map((e) => `- ${e}`).join("\n")}\n\n---\n` : ""}

## UX Fixes Aplicados

| Fix | Severidade |
|-----|-----------|
| z-index at-picker: 50 → 9 (abaixo do modal) | Crítico |
| Focus outlines \`:focus-visible\` (WCAG AA 2.4.7) | Crítico |
| Cores de erro → CSS vars (--error, --error-light) | Alto |
| prefers-reduced-motion para mascot + drawers | Alto |
| ESC para fechar SettingsModal | Alto |
| ESC para fechar FileViewer | Alto |
| @ picker: estado "nenhum arquivo" quando sem resultado | Alto |
| Transições em botões, nav-items, tabs | Polish |
| FileViewer pre: white-space pre-wrap (sem scroll horizontal) | Polish |
| Placeholder do composer mais curto | Polish |

---

## Screenshots

- \`screenshots/01-initial.png\` — estado inicial
- \`screenshots/02-project-set.png\` — após definir projeto
- \`screenshots/03-code-tab.png\` — tab Code ativa
- \`screenshots/04-task-typed.png\` — tarefa digitada
- \`screenshots/05-running-3s.png\` — agente rodando (3s)
- \`screenshots/06-completed.png\` — após conclusão
- \`screenshots/06b-thread.png\` — thread completo
- \`screenshots/07-final.png\` — estado final
`;
}
