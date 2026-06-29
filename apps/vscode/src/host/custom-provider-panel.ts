import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import type { CustomProviderPayload, CustomProviderInfo } from "../protocol.js";
import {
  listCustomProviders,
  addCustomProvider,
  removeCustomProvider,
} from "./custom-providers.js";
import { execCliJson } from "./cli.js";

type PanelToHost =
  | { type: "ready" }
  | { type: "save"; payload: CustomProviderPayload }
  | { type: "remove"; name: string }
  | { type: "test"; payload: CustomProviderPayload }
  | { type: "list" };

type HostToPanel =
  | { type: "init"; providers: CustomProviderInfo[] }
  | { type: "saveResult"; ok: boolean; message: string }
  | { type: "testResult"; ok: boolean; message: string; reply?: string }
  | { type: "listResult"; providers: CustomProviderInfo[] }
  | { type: "removeResult"; ok: boolean };

export class CustomProviderPanelProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "dist")],
    };
    view.webview.html = this.html(view.webview);
    view.webview.onDidReceiveMessage((msg: PanelToHost) => void this.onMessage(msg));
  }

  private post(msg: HostToPanel): void {
    void this.view?.webview.postMessage(msg);
  }

  private async onMessage(msg: PanelToHost): Promise<void> {
    switch (msg.type) {
      case "ready":
      case "list": {
        const providers = await listCustomProviders();
        this.post({ type: msg.type === "ready" ? "init" : "listResult", providers });
        return;
      }

      case "save": {
        try {
          await addCustomProvider(msg.payload);
          this.post({ type: "saveResult", ok: true, message: "✅ Provedor salvo com sucesso!" });
        } catch (err) {
          this.post({ type: "saveResult", ok: false, message: `❌ ${(err as Error).message}` });
        }
        return;
      }

      case "remove": {
        try {
          await removeCustomProvider(msg.name);
          this.post({ type: "removeResult", ok: true });
        } catch {
          this.post({ type: "removeResult", ok: false });
        }
        return;
      }

      case "test": {
        try {
          const res = (await execCliJson(
            ["test-custom-provider", "--json", "--payload", JSON.stringify(msg.payload)],
            undefined,
          )) as { ok?: boolean; message?: string; reply?: string } | null;
          if (res?.ok) {
            this.post({ type: "testResult", ok: true, message: res.message ?? "✅ Conexão OK!", reply: res.reply });
          } else {
            this.post({ type: "testResult", ok: false, message: res?.message ?? "❌ Falha na conexão." });
          }
        } catch (err) {
          this.post({ type: "testResult", ok: false, message: `❌ ${(err as Error).message}` });
        }
        return;
      }
    }
  }

  private html(webview: vscode.Webview): string {
    const nonce = randomBytes(16).toString("base64");
    const csp = [
      `default-src 'none'`,
      `style-src ${webview.cspSource} 'unsafe-inline'`,
      `script-src 'nonce-${nonce}'`,
    ].join("; ");

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Provedores Custom</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-sideBar-background);padding:12px}
    h2{font-size:13px;font-weight:600;margin-bottom:12px;color:var(--vscode-foreground)}
    label{display:block;font-size:11px;color:var(--vscode-descriptionForeground);margin-bottom:3px;margin-top:10px}
    input,select,textarea{width:100%;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:2px;padding:5px 7px;font-family:inherit;font-size:12px;outline:none}
    input:focus,select:focus,textarea:focus{border-color:var(--vscode-focusBorder)}
    textarea{resize:vertical;min-height:80px;font-family:var(--vscode-editor-font-family,monospace)}
    button{margin-top:12px;padding:6px 14px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:2px;cursor:pointer;font-size:12px;width:100%}
    button:hover{background:var(--vscode-button-hoverBackground)}
    button.secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
    button.secondary:hover{background:var(--vscode-button-secondaryHoverBackground)}
    .msg{margin-top:10px;padding:7px;border-radius:3px;font-size:11px;background:var(--vscode-editorWidget-background)}
    .msg.ok{border-left:3px solid var(--vscode-testing-iconPassed,#4caf50)}
    .msg.err{border-left:3px solid var(--vscode-testing-iconFailed,#f44336)}
    .auth-desc{font-size:11px;color:var(--vscode-descriptionForeground);margin-top:4px;font-style:italic}
    .divider{border:none;border-top:1px solid var(--vscode-panel-border);margin:16px 0}
    .provider-item{display:flex;justify-content:space-between;align-items:center;padding:6px;background:var(--vscode-editorWidget-background);border-radius:3px;margin-bottom:6px;font-size:12px}
    .provider-item button{width:auto;margin-top:0;padding:2px 8px;font-size:11px}
    #params-section{display:none}
    .param-row{display:flex;gap:6px;margin-bottom:6px}
    .param-row input{flex:1}
    .param-row button{width:auto;margin-top:0;padding:4px 8px}
    .warning{color:var(--vscode-inputValidation-warningForeground,#c09000);font-size:11px;margin-top:4px}
  </style>
</head>
<body>
  <h2>🔌 Provedores Custom</h2>

  <div id="list-section">
    <div id="providers-list"><em style="font-size:11px">Carregando...</em></div>
    <button id="btn-new">+ Novo provedor</button>
  </div>

  <div id="form-section" style="display:none">
    <label>Nome do provedor</label>
    <input id="name" placeholder="MeuProvedor" />

    <label>Tipo de autenticação</label>
    <select id="auth-type">
      <option value="none">Sem autenticação — A API é aberta, basta enviar o request.</option>
      <option value="api-key">API Key (Header) — Uma chave fixa é enviada em um header a cada chamada.</option>
      <option value="oauth2-client-credentials">OAuth2 — Client Credentials (2 chamadas) — Primeiro busca um token, depois usa no chat; o token é renovado automaticamente.</option>
    </select>
    <div id="auth-desc" class="auth-desc"></div>

    <div id="fields-api-key" style="display:none">
      <label>Nome do header (ex: Authorization)</label>
      <input id="header-name" value="Authorization" />
      <label>API Key (use \${ENV_VAR} para não expor o valor)</label>
      <input id="api-key" placeholder="\${MINHA_API_KEY}" />
      <div id="api-key-warning" class="warning" style="display:none">⚠️ Evite colar o valor direto. Prefira \${NOME_VAR} e configure a variável de ambiente.</div>
    </div>

    <div id="fields-oauth2" style="display:none">
      <label>URL do endpoint de token</label>
      <input id="token-url" placeholder="https://api.exemplo.com/oauth/token" />
      <label>Client ID</label>
      <input id="client-id" />
      <label>Client Secret (use \${ENV_VAR})</label>
      <input id="client-secret" placeholder="\${CLIENT_SECRET}" />
      <div id="secret-warning" class="warning" style="display:none">⚠️ Evite colar o valor direto. Prefira \${NOME_VAR}.</div>
      <label>JSONPath do token na resposta</label>
      <input id="token-path" value="$.access_token" />
      <label>JSONPath de expiração (opcional)</label>
      <input id="expires-path" placeholder="$.expires_in" />
    </div>

    <hr class="divider" />

    <label>URL do endpoint de chat (pode conter {{params.xxx}})</label>
    <input id="chat-url" placeholder="https://api.exemplo.com/v1/chat" />

    <label>Método HTTP</label>
    <select id="chat-method">
      <option value="POST">POST</option>
      <option value="GET">GET</option>
      <option value="PUT">PUT</option>
    </select>

    <label>Template do body (JSON com {{prompt}})</label>
    <textarea id="body-template">{\n  "user_prompt": "{{prompt}}"\n}</textarea>

    <label>JSONPath da resposta (ex: $.message)</label>
    <input id="response-path" placeholder="$.message" />

    <label>JSONPath do session ID (opcional)</label>
    <input id="session-path" placeholder="$.message_id" />

    <div id="params-section">
      <hr class="divider" />
      <label>Parâmetros detectados em {{params.xxx}}</label>
      <div id="params-rows"></div>
    </div>

    <hr class="divider" />

    <label>Modo de segurança</label>
    <select id="safety-mode">
      <option value="review">Review — intercepta sugestões de edição/comando para aprovação</option>
      <option value="read-only">Read-Only — apenas leitura, sem mutações locais</option>
      <option value="bypass">Bypass — envio direto sem travas</option>
    </select>

    <button id="btn-test" class="secondary">🔌 Testar conexão</button>
    <div id="test-result" style="display:none" class="msg"></div>

    <button id="btn-save">✅ Salvar provedor</button>
    <button id="btn-cancel" class="secondary" style="margin-top:4px">Cancelar</button>
    <div id="save-result" style="display:none" class="msg"></div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let params = {};

    // Detect params in templates
    function detectParams(text) {
      const matches = [...text.matchAll(/\{\{params\.([^}]+)\}\}/g)];
      return [...new Set(matches.map(m => m[1]))];
    }

    function refreshParamSection() {
      const url = document.getElementById('chat-url').value;
      const body = document.getElementById('body-template').value;
      const headers = '';
      const keys = detectParams(url + body + headers);
      const section = document.getElementById('params-section');
      const rows = document.getElementById('params-rows');
      if (keys.length === 0) { section.style.display = 'none'; return; }
      section.style.display = 'block';
      rows.innerHTML = '';
      for (const k of keys) {
        const row = document.createElement('div');
        row.className = 'param-row';
        row.innerHTML = \`<input placeholder="\${k}" value="\${params[k] ?? ''}" data-key="\${k}" />\`;
        row.querySelector('input').addEventListener('input', e => { params[k] = e.target.value; });
        rows.appendChild(row);
      }
    }

    // Auth type display
    const authDescriptions = {
      'none': 'A API é aberta — basta enviar o request direto.',
      'api-key': 'Uma chave fixa é enviada em um header a cada chamada.',
      'oauth2-client-credentials': 'Primeiro busca um token de acesso (POST /token), depois usa no header do chat. O token é renovado automaticamente quando expira.'
    };
    document.getElementById('auth-type').addEventListener('change', () => updateAuthFields());

    function updateAuthFields() {
      const type = document.getElementById('auth-type').value;
      document.getElementById('auth-desc').textContent = authDescriptions[type] ?? '';
      document.getElementById('fields-api-key').style.display = type === 'api-key' ? 'block' : 'none';
      document.getElementById('fields-oauth2').style.display = type === 'oauth2-client-credentials' ? 'block' : 'none';
    }

    // Warn when literal secret detected
    function checkSecretWarning(inputId, warningId) {
      const val = document.getElementById(inputId).value;
      const warn = document.getElementById(warningId);
      warn.style.display = val && !val.startsWith('\${') ? 'block' : 'none';
    }
    document.getElementById('api-key').addEventListener('input', () => checkSecretWarning('api-key', 'api-key-warning'));
    document.getElementById('client-secret')?.addEventListener('input', () => checkSecretWarning('client-secret', 'secret-warning'));

    // Param detection
    document.getElementById('chat-url').addEventListener('input', refreshParamSection);
    document.getElementById('body-template').addEventListener('input', refreshParamSection);

    // Nav
    document.getElementById('btn-new').addEventListener('click', () => {
      document.getElementById('list-section').style.display = 'none';
      document.getElementById('form-section').style.display = 'block';
      updateAuthFields();
    });
    document.getElementById('btn-cancel').addEventListener('click', () => {
      document.getElementById('form-section').style.display = 'none';
      document.getElementById('list-section').style.display = 'block';
      document.getElementById('test-result').style.display = 'none';
      document.getElementById('save-result').style.display = 'none';
    });

    function buildPayload() {
      const authType = document.getElementById('auth-type').value;
      let auth;
      if (authType === 'none') {
        auth = { type: 'none' };
      } else if (authType === 'api-key') {
        auth = { type: 'api-key', headerName: document.getElementById('header-name').value, apiKey: document.getElementById('api-key').value };
      } else {
        auth = {
          type: 'oauth2-client-credentials',
          tokenUrl: document.getElementById('token-url').value,
          clientId: document.getElementById('client-id').value,
          clientSecret: document.getElementById('client-secret').value,
          tokenPath: document.getElementById('token-path').value || '$.access_token',
          expiresPath: document.getElementById('expires-path').value || undefined,
        };
      }
      return {
        name: document.getElementById('name').value.trim(),
        auth,
        chat: {
          url: document.getElementById('chat-url').value.trim(),
          method: document.getElementById('chat-method').value,
          headers: {},
          bodyTemplate: document.getElementById('body-template').value,
        },
        responsePath: document.getElementById('response-path').value.trim(),
        sessionPath: document.getElementById('session-path').value.trim() || undefined,
        params,
        safetyMode: document.getElementById('safety-mode').value,
      };
    }

    document.getElementById('btn-test').addEventListener('click', () => {
      const r = document.getElementById('test-result');
      r.style.display = 'block';
      r.className = 'msg';
      r.textContent = '⏳ Testando conexão...';
      vscode.postMessage({ type: 'test', payload: buildPayload() });
    });

    document.getElementById('btn-save').addEventListener('click', () => {
      const payload = buildPayload();
      if (!payload.name) { alert('Informe o nome do provedor.'); return; }
      if (!payload.chat.bodyTemplate.includes('{{prompt}}')) { alert('O body template deve conter {{prompt}}.'); return; }
      vscode.postMessage({ type: 'save', payload });
    });

    // List rendering
    function renderList(providers) {
      const el = document.getElementById('providers-list');
      if (!providers.length) { el.innerHTML = '<em style="font-size:11px">Nenhum provedor configurado.</em>'; return; }
      el.innerHTML = providers.map(p => \`
        <div class="provider-item">
          <span>🔌 <strong>\${p.name}</strong> <span style="color:var(--vscode-descriptionForeground)">\${p.authType}</span></span>
          <button data-remove="\${p.name}" class="secondary">✕</button>
        </div>
      \`).join('');
      el.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (confirm('Remover ' + btn.dataset.remove + '?')) vscode.postMessage({ type: 'remove', name: btn.dataset.remove });
        });
      });
    }

    window.addEventListener('message', e => {
      const msg = e.data;
      if (msg.type === 'init' || msg.type === 'listResult') renderList(msg.providers);
      if (msg.type === 'testResult') {
        const r = document.getElementById('test-result');
        r.className = 'msg ' + (msg.ok ? 'ok' : 'err');
        r.textContent = msg.message + (msg.reply ? ' Resposta: ' + msg.reply : '');
      }
      if (msg.type === 'saveResult') {
        const r = document.getElementById('save-result');
        r.style.display = 'block';
        r.className = 'msg ' + (msg.ok ? 'ok' : 'err');
        r.textContent = msg.message;
        if (msg.ok) { vscode.postMessage({ type: 'list' }); }
      }
      if (msg.type === 'removeResult' && msg.ok) { vscode.postMessage({ type: 'list' }); }
    });

    vscode.postMessage({ type: 'ready' });
    updateAuthFields();
  </script>
</body>
</html>`;
  }
}
