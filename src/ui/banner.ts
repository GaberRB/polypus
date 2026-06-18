import pc from "picocolors";
import { t } from "../core/i18n/index.js";
import { VERSION } from "../core/version.js";

const RESET = "\x1b[0m";
const useColor =
  (Boolean(process.stdout.isTTY) || Boolean(process.env.FORCE_COLOR)) && !process.env.NO_COLOR;
const animated =
  Boolean(process.stdout.isTTY) && !process.env.NO_COLOR && !process.env.POLYPUS_NO_ANIM;

/** Author / social links shown on startup. */
const AUTHOR = {
  name: "Gabriel Rios",
  github: "github.com/GaberRB",
  linkedin: "linkedin.com/in/gabriel-riosb",
};

/** Build a 24-bit truecolor wrapper, no-op when colors are disabled. */
function rgb(r: number, g: number, b: number, bold = false): (s: string) => string {
  return (s: string) =>
    useColor ? `\x1b[${bold ? "1;" : ""}38;2;${r};${g};${b}m${s}${RESET}` : s;
}

// Violet gradient (light → deep) plus white glasses and pink cheeks.
const c0 = rgb(224, 209, 255);
const c1 = rgb(199, 176, 253);
const c2 = rgb(171, 142, 250);
const c3 = rgb(146, 102, 245);
const c4 = rgb(122, 74, 222);
const lens = rgb(255, 255, 255, true);
const blush = rgb(255, 138, 190, true);
const GRAD = [c0, c1, c1, c2, c2, c2, c3, c3, c3, c4, c4];

// Cute kawaii octopus with round glasses, a smile, rosy cheeks and long
// chubby tentacles ending in little curls.
//   '◉' white lenses · '(' ')' glasses frames · '‿' smile · '♥' blush.
const ART = [
  "     ▄▄▄▄▄▄▄▄▄▄     ",
  "   ▟██████████████▙   ",
  "  ████████████████████  ",
  " ██♥  (◉)  ‿  (◉)  ♥██ ",
  "  ████████████████████  ",
  "  ▜████████████████▛  ",
  "  ██  ██  ██  ██  ██  ",
  "  ██  ██  ██  ██  ██  ",
  "  ██  ██  ██  ██  ██  ",
  " ╰╝  ╚╝  ╚╝  ╚╝  ╚╮ ",
];

// Alternate tentacle curls for the "coming alive" wiggle on startup.
const TENTACLE_FRAMES = [
  " ╰╝  ╚╝  ╚╝  ╚╝  ╚╮ ",
  " ╚╮  ╰╝  ╚╝  ╰╝  ╚╝ ",
  " ╰╝  ╚╝  ╰╝  ╚╝  ╚╮ ",
];

const WIDTH = Math.max(...[...ART].map((l) => [...l].length));

function center(line: string): string {
  const pad = WIDTH - [...line].length;
  const left = Math.floor(pad / 2);
  return " ".repeat(left) + line + " ".repeat(pad - left);
}

// Filled 5-row block font for the wordmark. Each glyph is 6 columns wide.
const GLYPHS: Record<string, string[]> = {
  P: ["██████", "██  ██", "██████", "██    ", "██    "],
  O: ["██████", "██  ██", "██  ██", "██  ██", "██████"],
  L: ["██    ", "██    ", "██    ", "██    ", "██████"],
  Y: ["██  ██", "██  ██", " ████ ", "  ██  ", "  ██  "],
  U: ["██  ██", "██  ██", "██  ██", "██  ██", "██████"],
  S: ["██████", "██    ", "██████", "    ██", "██████"],
};

const WORD_GRAD = [
  rgb(199, 176, 253, true),
  rgb(171, 142, 250, true),
  rgb(171, 142, 250, true),
  rgb(146, 102, 245, true),
  rgb(146, 102, 245, true),
];

/** Filled block letters, one colored string per row (vertical gradient). */
function wordmarkLines(text: string): string[] {
  const letters = [...text].map((ch) => GLYPHS[ch]).filter(Boolean) as string[][];
  return [0, 1, 2, 3, 4].map((row) =>
    (WORD_GRAD[row] ?? c3)(letters.map((g) => g[row]).join("  ")),
  );
}

function colorChar(rowIdx: number, ch: string): string {
  if (ch === " ") return ch;
  if (ch === "◉" || ch === "(" || ch === ")") return lens(ch);
  if (ch === "♥") return blush(ch);
  if (ch === "‿") return c0(ch);
  return (GRAD[rowIdx] ?? c3)(ch);
}

/** Center + color one octopus row (any string), tinted as the given gradient row. */
function renderArtRow(rowIdx: number, line: string): string {
  return [...center(line)].map((ch) => colorChar(rowIdx, ch)).join("");
}

const tagline = (): string => c1(t("welcome.tagline")) + pc.dim(`   v${VERSION}`);

function authorLine(): string {
  return (
    pc.dim("by ") +
    c2(AUTHOR.name) +
    pc.dim("  ·  ") +
    c1(AUTHOR.github) +
    pc.dim("  ·  ") +
    c1(AUTHOR.linkedin)
  );
}

/** The full static banner (octopus + wordmark + tagline + author). */
export function banner(): string {
  const art = ART.map((line, i) => renderArtRow(i, line)).join("\n");
  const word = wordmarkLines("POLYPUS").join("\n");
  return `\n${art}\n\n${word}\n\n  ${tagline()}\n  ${authorLine()}\n`;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Animated startup: the octopus draws itself in line by line, wiggles its
 * tentacles to "come alive", then the wordmark, tagline and author appear.
 * Falls back to the static banner when not attached to a TTY.
 */
async function animateIntro(): Promise<void> {
  if (!animated) {
    console.log(banner());
    return;
  }

  process.stdout.write("\n");
  for (let i = 0; i < ART.length; i++) {
    console.log(renderArtRow(i, ART[i]!));
    await sleep(45);
  }

  // Wiggle the just-drawn tentacle line in place.
  const last = ART.length - 1;
  for (let k = 0; k < 6; k++) {
    const frame = renderArtRow(last, TENTACLE_FRAMES[k % TENTACLE_FRAMES.length]!);
    process.stdout.write(`\x1b[1A\r\x1b[K${frame}\n`);
    await sleep(85);
  }

  process.stdout.write("\n");
  for (const line of wordmarkLines("POLYPUS")) {
    console.log(line);
    await sleep(40);
  }

  process.stdout.write("\n");
  console.log("  " + tagline());
  await sleep(140);
  console.log("  " + authorLine());
  console.log("");
}

export interface WelcomeInfo {
  agentName: string;
  provider: string;
  model: string;
  toolMode: string;
  mode: string;
  workspace: string;
}

/** Animate the intro, then print the colored session info panel and hints. */
export async function printWelcome(info: WelcomeInfo): Promise<void> {
  await animateIntro();

  const bar = c2("│ ");
  const label = (s: string) => pc.dim(s.padEnd(8));
  const rule = c3("  " + "─".repeat(46));

  console.log(rule);
  console.log("  " + bar + label(t("welcome.agent")) + pc.bold(info.agentName));
  console.log(
    "  " + bar + label(t("welcome.model")) +
      `${info.model} ` + pc.dim(`(${info.provider} · ${info.toolMode})`),
  );
  console.log("  " + bar + label(t("welcome.mode")) + modeColor(info.mode));
  console.log("  " + bar + label(t("welcome.workspace")) + pc.dim(info.workspace));
  console.log(rule);
  console.log("  " + pc.dim(t("welcome.hints")) + "\n");
}

function modeColor(mode: string): string {
  if (mode === "bypass") return pc.yellow(mode);
  if (mode === "plan") return pc.cyan(mode);
  return pc.green(mode);
}

/** Styled REPL prompt, e.g. "🐙 polypus(review) › ". */
export function promptLabel(mode: string): string {
  return c2("🐙 polypus") + pc.dim(`(${mode})`) + c3(" › ");
}
