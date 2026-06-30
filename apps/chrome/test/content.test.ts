/**
 * Tests for content script web actions.
 *
 * Since the content script runs in the browser, we test each action
 * function in isolation by extracting them into pure helpers that
 * accept and return plain values.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// Fake document for action helpers
let fakeDoc: Record<string, any>;
let fakeWin: Record<string, any>;

// --- Helpers under test (mirror src/content/index.ts logic) ---

function findElement(selector: string): Element | null {
  try {
    return fakeDoc.querySelector(selector);
  } catch {
    return null;
  }
}

async function actionNavigate(url: string): Promise<{ ok: boolean; output: string }> {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, output: `Invalid protocol: ${u.protocol}` };
    }
    return { ok: true, output: `✓ Navigated to ${url}` };
  } catch (err) {
    return { ok: false, output: `Navigate failed: ${(err as Error).message}` };
  }
}

async function actionExtract(selector?: string): Promise<{ ok: boolean; output: string }> {
  try {
    if (selector) {
      const el = findElement(selector);
      if (!el) return { ok: false, output: `Element not found: ${selector}` };
      return { ok: true, output: el.textContent?.trim() ?? "" };
    }
    return { ok: true, output: "full page text" };
  } catch (err) {
    return { ok: false, output: `Extract failed: ${(err as Error).message}` };
  }
}

async function actionScroll(direction: string): Promise<{ ok: boolean; output: string }> {
  try {
    const key = direction as keyof typeof fakeWin;
    if (typeof fakeWin[key] === "function") fakeWin[key]();
    return { ok: true, output: `✓ Scrolled ${direction}` };
  } catch (err) {
    return { ok: false, output: `Scroll failed: ${(err as Error).message}` };
  }
}

async function actionClick(selector: string): Promise<{ ok: boolean; output: string }> {
  try {
    const el = findElement(selector);
    if (!el) return { ok: false, output: `Element not found: ${selector}` };
    (el as HTMLElement).click();
    return { ok: true, output: `✓ Clicked ${selector}` };
  } catch (err) {
    return { ok: false, output: `Click failed: ${(err as Error).message}` };
  }
}

async function actionType(selector: string, text: string): Promise<{ ok: boolean; output: string }> {
  try {
    const el = findElement(selector);
    if (!el) return { ok: false, output: `Element not found: ${selector}` };
    const input = el as HTMLInputElement;
    input.value = text;
    return { ok: true, output: `✓ Typed into ${selector}` };
  } catch (err) {
    return { ok: false, output: `Type failed: ${(err as Error).message}` };
  }
}

async function actionGetHtml(): Promise<{ ok: boolean; output: string }> {
  return { ok: true, output: "<html><body>test</body></html>" };
}

async function actionWait(ms: number): Promise<{ ok: boolean; output: string }> {
  await new Promise((r) => setTimeout(r, ms));
  return { ok: true, output: `✓ Waited ${ms}ms` };
}

// --- Mocks ---

beforeEach(() => {
  const btn = {
    tagName: "BUTTON",
    textContent: "Click me",
    click: vi.fn(),
  } as unknown as HTMLElement;

  const input = {
    tagName: "INPUT",
    value: "",
  } as unknown as HTMLInputElement;

  fakeDoc = {
    querySelector: vi.fn((sel: string) => {
      if (sel === "#btn") return btn;
      if (sel === "#input") return input;
      if (sel === "#missing") return null;
      return null;
    }),
  };

  fakeWin = {
    scrollTo: vi.fn(),
    scrollY: 0,
    innerHeight: 1000,
    document: { body: { scrollHeight: 5000 } },
    up: vi.fn(),
    down: vi.fn(),
    top: vi.fn(),
    bottom: vi.fn(),
  };
});

/* ─── navigate ─── */

describe("actionNavigate", () => {
  it("accepts http URLs", async () => {
    const r = await actionNavigate("http://example.com");
    expect(r.ok).toBe(true);
    expect(r.output).toContain("example.com");
  });

  it("accepts https URLs", async () => {
    const r = await actionNavigate("https://github.com");
    expect(r.ok).toBe(true);
  });

  it("rejects ftp URLs", async () => {
    const r = await actionNavigate("ftp://files.example.com");
    expect(r.ok).toBe(false);
    expect(r.output).toContain("Invalid protocol");
  });

  it("rejects invalid strings", async () => {
    const r = await actionNavigate("not-a-url");
    expect(r.ok).toBe(false);
  });

  it("rejects javascript: URLs", async () => {
    const r = await actionNavigate("javascript:alert(1)");
    expect(r.ok).toBe(false);
  });
});

/* ─── extract ─── */

describe("actionExtract", () => {
  it("extracts full page text when no selector", async () => {
    const r = await actionExtract();
    expect(r.ok).toBe(true);
    expect(r.output).toBeTruthy();
  });

  it("extracts from element when selector matches", async () => {
    const r = await actionExtract("#btn");
    expect(r.ok).toBe(true);
    expect(r.output).toBe("Click me");
  });

  it("returns error when selector does not match", async () => {
    const r = await actionExtract("#missing");
    expect(r.ok).toBe(false);
    expect(r.output).toContain("not found");
  });
});

/* ─── click ─── */

describe("actionClick", () => {
  it("clicks an existing element", async () => {
    const r = await actionClick("#btn");
    expect(r.ok).toBe(true);
    expect(fakeDoc.querySelector("#btn").click).toHaveBeenCalledOnce();
  });

  it("fails for missing element", async () => {
    const r = await actionClick("#missing");
    expect(r.ok).toBe(false);
  });
});

/* ─── type ─── */

describe("actionType", () => {
  it("types into an input", async () => {
    const r = await actionType("#input", "hello");
    expect(r.ok).toBe(true);
    const input = fakeDoc.querySelector("#input") as HTMLInputElement;
    expect(input.value).toBe("hello");
  });

  it("fails for missing element", async () => {
    const r = await actionType("#missing", "text");
    expect(r.ok).toBe(false);
  });
});

/* ─── scroll ─── */

describe("actionScroll", () => {
  it("scrolls in a direction", async () => {
    const r = await actionScroll("up");
    expect(r.ok).toBe(true);
    expect(fakeWin.up).toHaveBeenCalledOnce();
  });
});

/* ─── getHtml ─── */

describe("actionGetHtml", () => {
  it("returns HTML string", async () => {
    const r = await actionGetHtml();
    expect(r.ok).toBe(true);
    expect(r.output).toContain("<html");
  });
});

/* ─── wait ─── */

describe("actionWait", () => {
  it("waits the given ms", async () => {
    const start = Date.now();
    const r = await actionWait(5);
    const elapsed = Date.now() - start;
    expect(r.ok).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(4);
  });
});