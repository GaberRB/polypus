/**
 * Extension entry (T1/T4/T5/T8). Registers the Polypus chat as a webview view,
 * bridges webview messages to the run bridge + workspace APIs, and stores the
 * OpenRouter key in SecretStorage.
 */
import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import { RunBridge } from "./host/runBridge.js";
import { listConfiguredAgents } from "./host/agents.js";
import type { HostToWebview, WebviewToHost } from "./protocol.js";
import type { FileEntry, Mode } from "@gaberrb/polypus-chat-ui";

const SECRET_KEY = "polypus.openrouterApiKey";
/** Env var the CLI reads the OpenRouter key from. */
const KEY_ENV = "OPENROUTER_API_KEY";

export function activate(context: vscode.ExtensionContext): void {
  const provider = new PolypusChatProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("polypus.chat", provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand("polypus.focusChat", () => {
      void vscode.commands.executeCommand("polypus.chat.focus");
    }),
    vscode.commands.registerCommand("polypus.setApiKey", () => provider.promptApiKey()),
  );
}

export function deactivate(): void {
  /* the bridge is disposed with the provider's webview */
}

class PolypusChatProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private readonly bridge = new RunBridge();

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    const webview = view.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "dist")],
    };
    webview.html = this.html(webview);

    view.onDidDispose(() => this.bridge.stop());
    webview.onDidReceiveMessage((msg: WebviewToHost) => void this.onMessage(msg));
  }

  /** Prompt for the OpenRouter key and persist it to SecretStorage. */
  async promptApiKey(): Promise<void> {
    const key = await vscode.window.showInputBox({
      title: "Chave do OpenRouter",
      prompt: "Cole sua chave (sk-or-…). Crie uma em https://openrouter.ai/keys",
      password: true,
      ignoreFocusOut: true,
    });
    if (!key?.trim()) return;
    await this.context.secrets.store(SECRET_KEY, key.trim());
    await this.postInit(); // refresh composer state (unblocks it)
  }

  private post(msg: HostToWebview): void {
    void this.view?.webview.postMessage(msg);
  }

  private async postInit(): Promise<void> {
    const hasKey = Boolean(await this.context.secrets.get(SECRET_KEY));
    const cfg = vscode.workspace.getConfiguration("polypus");
    this.post({
      type: "init",
      hasProject: (vscode.workspace.workspaceFolders?.length ?? 0) > 0,
      hasKey,
      mode: (cfg.get<string>("mode") as Mode) ?? "review",
    });
  }

  private async onMessage(msg: WebviewToHost): Promise<void> {
    switch (msg.type) {
      case "ready":
        await this.postInit();
        return;

      case "run": {
        const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!cwd) {
          this.post({ type: "event", event: { type: "error", message: "Abra uma pasta primeiro." } });
          this.post({ type: "event", event: { type: "end" } });
          return;
        }
        const key = await this.context.secrets.get(SECRET_KEY);
        if (!key) {
          await this.promptApiKey();
          const retry = await this.context.secrets.get(SECRET_KEY);
          if (!retry) {
            this.post({ type: "event", event: { type: "error", message: "Nenhuma chave configurada." } });
            this.post({ type: "event", event: { type: "end" } });
            return;
          }
        }
        this.bridge.start(
          {
            task: msg.task,
            controls: msg.controls,
            cwd,
            resumeSessionId: msg.resumeSessionId,
            env: { [KEY_ENV]: (await this.context.secrets.get(SECRET_KEY)) ?? "" },
          },
          (event) => this.post({ type: "event", event }),
        );
        return;
      }

      case "stop":
        this.bridge.stop();
        return;

      case "respondAsk":
        this.bridge.respond(msg.id, msg.selected);
        return;

      case "setApiKey":
        await this.promptApiKey();
        return;

      case "rpc":
        await this.handleRpc(msg);
        return;
    }
  }

  private async handleRpc(
    msg: Extract<WebviewToHost, { type: "rpc" }>,
  ): Promise<void> {
    try {
      if (msg.method === "getModelPrice") {
        // TODO(T10): resolve via @gaberrb/polypus/lib listOpenRouterModels.
        this.post({ type: "rpcResult", rpcId: msg.rpcId, ok: true, data: null });
        return;
      }
      if (msg.method === "listFiles") {
        const found = await vscode.workspace.findFiles("**/*", "**/node_modules/**", 50);
        const q = msg.query.toLowerCase();
        const entries: FileEntry[] = found
          .map((u) => ({ name: u.path.split("/").pop() ?? u.fsPath, path: u.fsPath }))
          .filter((f) => !q || f.name.toLowerCase().includes(q));
        this.post({ type: "rpcResult", rpcId: msg.rpcId, ok: true, data: entries });
        return;
      }
      if (msg.method === "readFile") {
        const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(msg.path));
        this.post({ type: "rpcResult", rpcId: msg.rpcId, ok: true, data: Buffer.from(bytes).toString("utf8") });
        return;
      }
      if (msg.method === "listAgents") {
        this.post({ type: "rpcResult", rpcId: msg.rpcId, ok: true, data: await listConfiguredAgents() });
        return;
      }
    } catch (err) {
      this.post({ type: "rpcResult", rpcId: msg.rpcId, ok: false, error: (err as Error).message });
    }
  }

  private html(webview: vscode.Webview): string {
    const nonce = randomBytes(16).toString("base64");
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.js"),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.css"),
    );
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
      `font-src ${webview.cspSource}`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Polypus</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
