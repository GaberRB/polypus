import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import type { CustomProviderPayload, CustomProviderInfo } from "../protocol.js";
import {
  listCustomProviders,
  addCustomProvider,
  removeCustomProvider,
  testCustomProviderInProcess,
} from "./custom-providers.js";
import { listConfiguredAgents } from "./agents.js";
import { execCli } from "./cli.js";

const SECRET_KEY = "polypus.openrouterApiKey";

interface AgentEntry { name: string; provider: string; model: string; isDefault: boolean }

type PanelToHost =
  | { type: "ready" }
  | { type: "save"; payload: CustomProviderPayload }
  | { type: "remove"; name: string }
  | { type: "removeAgent"; name: string }
  | { type: "test"; payload: CustomProviderPayload }
  | { type: "setApiKey" }
  | { type: "clearApiKey" }
  | { type: "list" };

type HostToPanel =
  | {
      type: "init";
      providers: CustomProviderInfo[];
      agents: AgentEntry[];
      keySet: boolean;
      keyPreview: string;
    }
  | { type: "saveResult"; ok: boolean; message: string }
  | { type: "testResult"; ok: boolean; message: string; reply?: string }
  | { type: "listResult"; providers: CustomProviderInfo[]; agents: AgentEntry[]; keySet: boolean; keyPreview: string }
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

  private async fullState(): Promise<Omit<HostToPanel & { type: "init" }, "type">> {
    const [providers, agents, rawKey] = await Promise.all([
      listCustomProviders(),
      listConfiguredAgents(),
      this.context.secrets.get(SECRET_KEY),
    ]);
    const keySet = Boolean(rawKey);
    const keyPreview = rawKey ? `sk-or-…${rawKey.slice(-4)}` : "";
    return { providers, agents: agents as AgentEntry[], keySet, keyPreview };
  }

  private async onMessage(msg: PanelToHost): Promise<void> {
    switch (msg.type) {
      case "ready": {
        const state = await this.fullState();
        this.post({ type: "init", ...state });
        return;
      }

      case "list": {
        const state = await this.fullState();
        this.post({ type: "listResult", ...state });
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

      case "removeAgent": {
        try {
          await execCli(["remove-agent", msg.name]);
          this.post({ type: "removeResult", ok: true });
        } catch {
          this.post({ type: "removeResult", ok: false });
        }
        return;
      }

      case "setApiKey": {
        const key = await vscode.window.showInputBox({
          title: "Chave do OpenRouter",
          prompt: "Cole sua chave (sk-or-…). Crie uma em https://openrouter.ai/keys",
          password: true,
          ignoreFocusOut: true,
        });
        if (key?.trim()) {
          await this.context.secrets.store(SECRET_KEY, key.trim());
          const state = await this.fullState();
          this.post({ type: "listResult", ...state });
        }
        return;
      }

      case "clearApiKey": {
        await this.context.secrets.delete(SECRET_KEY);
        const state = await this.fullState();
        this.post({ type: "listResult", ...state });
        return;
      }

      case "test": {
        try {
          const res = await testCustomProviderInProcess(msg.payload);
          this.post({ type: "testResult", ok: res.ok, message: res.message, reply: res.reply });
        } catch (err) {
          this.post({ type: "testResult", ok: false, message: `❌ Erro inesperado: ${(err as Error).message}` });
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
  <title>Provedores &amp; Chaves</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:var(--vscode-font-family);font-size:var(--vscode-font-size);color:var(--vscode-foreground);background:var(--vscode-sideBar-background);padding:12px}
    h2{font-size:13px;font-weight:600;margin-bottom:12px}
    h3{font-size:11px;font-weight:600;color:var(--vscode-descriptionForeground);text-transform:uppercase;letter-spacing:.05em;margin:14px 0 6px}
    label{display:block;font-size:11px;color:var(--vscode-descriptionForeground);margin-bottom:3px;margin-top:8px}
    input,select,textarea{width:100%;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:2px;padding:5px 7px;font-family:inherit;font-size:12px;outline:none}
    input:focus,select:focus,textarea:focus{border-color:var(--vscode-focusBorder)}
    textarea{resize:vertical;min-height:72px;font-family:var(--vscode-editor-font-family,monospace);font-size:11px}
    button{margin-top:8px;padding:5px 12px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:2px;cursor:pointer;font-size:12px;width:100%}
    button:hover{background:var(--vscode-button-hoverBackground)}
    button.secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
    button.secondary:hover{background:var(--vscode-button-secondaryHoverBackground)}
    button.sm{width:auto;padding:3px 9px;font-size:11px;margin-top:0}
    .msg{margin-top:8px;padding:7px 9px;border-radius:3px;font-size:11px;background:var(--vscode-editorWidget-background);word-break:break-word}
    .msg.ok{border-left:3px solid var(--vscode-testing-iconPassed,#4caf50)}
    .msg.err{border-left:3px solid var(--vscode-testing-iconFailed,#f44336)}
    .auth-desc{font-size:11px;color:var(--vscode-descriptionForeground);margin-top:4px;font-style:italic;line-height:1.4}
    .divider{border:none;border-top:1px solid var(--vscode-panel-border);margin:14px 0}
    .row{display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--vscode-editorWidget-background);border-radius:3px;margin-bottom:6px;font-size:12px;gap:6px}
    .row-info{flex:1;min-width:0}
    .row-title{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .row-sub{font-size:10px;color:var(--vscode-descriptionForeground);margin-top:1px}
    .kv-row{display:flex;gap:5px;margin-bottom:5px;align-items:center}
    .kv-row input{flex:1}
    .warning{color:var(--vscode-inputValidation-warningForeground,#c09000);font-size:11px;margin-top:3px}
    .curl-box{background:var(--vscode-editorWidget-background);border-radius:3px;padding:8px;margin-top:8px}
    .curl-box textarea{min-height:56px;font-size:11px}
    details summary{cursor:pointer;font-size:11px;color:var(--vscode-descriptionForeground);user-select:none;padding:4px 0}
    details summary:hover{color:var(--vscode-foreground)}
    details[open] summary{margin-bottom:6px}
    /* key card */
    .key-card{background:var(--vscode-editorWidget-background);border-radius:4px;padding:10px 12px;margin-bottom:14px}
    .key-status{display:flex;align-items:center;gap:8px;margin-bottom:8px}
    .badge{font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600}
    .badge.set{background:var(--vscode-testing-iconPassed,#4caf50);color:#fff}
    .badge.unset{background:var(--vscode-testing-iconFailed,#f44336);color:#fff}
    .key-preview{font-size:11px;color:var(--vscode-descriptionForeground);font-family:monospace}
    .btn-row{display:flex;gap:6px;flex-wrap:wrap}
    .btn-row button{flex:1;margin-top:0;min-width:80px}
    /* section header */
    .section-hdr{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--vscode-descriptionForeground);margin:16px 0 8px}
    .empty{font-size:11px;color:var(--vscode-descriptionForeground);font-style:italic;padding:6px 0}
  </style>
</head>
<body>

  <!-- LIST VIEW -->
  <div id="list-view">

    <!-- ── 1. Chave OpenRouter ───────────────────────────────────── -->
    <div class="key-card">
      <div class="key-status">
        <strong style="font-size:12px">OpenRouter</strong>
        <span id="key-badge" class="badge unset">não configurada</span>
      </div>
      <div id="key-preview" class="key-preview" style="margin-bottom:8px;display:none"></div>
      <div class="btn-row">
        <button class="secondary" id="btn-set-key">🔑 Configurar chave</button>
        <button class="secondary" id="btn-clear-key" style="display:none;color:var(--vscode-inputValidation-errorForeground,#f44)">✕ Remover</button>
      </div>
    </div>

    <!-- ── 2. Agentes configurados ───────────────────────────────── -->
    <div class="section-hdr">Agentes configurados</div>
    <div id="agents-list"><em class="empty">Carregando…</em></div>

    <!-- ── 3. Provedores Custom ──────────────────────────────────── -->
    <div class="section-hdr">Provedores custom</div>
    <div id="custom-list"><em class="empty">Carregando…</em></div>
    <button id="btn-new" style="margin-top:6px">+ Novo provedor custom</button>

  </div>

  <!-- FORM VIEW -->
  <div id="form-view" style="display:none">

    <!-- cURL Import -->
    <details id="curl-import">
      <summary>📋 Importar de cURL (opcional)</summary>
      <div class="curl-box">
        <label>Cole o comando cURL aqui (auth ou chat)</label>
        <textarea id="curl-auth-input" placeholder="curl -X POST https://api.exemplo.com/oauth/token -H 'Content-Type: application/x-www-form-urlencoded' -d 'grant_type=client_credentials&client_id=xxx&client_secret=yyy'"></textarea>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button class="secondary sm" id="btn-import-auth" style="flex:1">⬇ Importar como Auth</button>
          <button class="secondary sm" id="btn-import-chat" style="flex:1">⬇ Importar como Chat</button>
        </div>
        <div id="curl-result" class="msg" style="display:none"></div>
      </div>
    </details>

    <hr class="divider" />

    <!-- Basic info -->
    <label>Nome do provedor</label>
    <input id="name" placeholder="MeuProvedor" />

    <label>Tipo de autenticação</label>
    <select id="auth-type">
      <option value="none">Sem autenticação</option>
      <option value="api-key">API Key (Header)</option>
      <option value="oauth2-client-credentials">OAuth2 — Client Credentials</option>
    </select>
    <div id="auth-desc" class="auth-desc"></div>

    <!-- API Key fields -->
    <div id="fields-api-key" style="display:none">
      <label>Nome do header</label>
      <input id="header-name" value="Authorization" />
      <label>API Key (prefira \${ENV_VAR})</label>
      <input id="api-key" placeholder="\${MINHA_API_KEY}" />
      <div id="api-key-warning" class="warning" style="display:none">⚠️ Prefira \${NOME_VAR} — nunca cole a chave inline.</div>
    </div>

    <!-- OAuth2 fields -->
    <div id="fields-oauth2" style="display:none">
      <label>URL do endpoint de token</label>
      <input id="token-url" placeholder="https://api.exemplo.com/oauth/token" />

      <label>grant_type</label>
      <input id="grant-type" value="client_credentials" placeholder="client_credentials" />

      <label>Client ID</label>
      <input id="client-id" />

      <label>Client Secret (prefira \${ENV_VAR})</label>
      <input id="client-secret" placeholder="\${CLIENT_SECRET}" />
      <div id="secret-warning" class="warning" style="display:none">⚠️ Prefira \${NOME_VAR} — nunca cole a chave inline.</div>

      <details style="margin-top:8px">
        <summary>Headers extras da requisição de token</summary>
        <div id="token-headers-rows"></div>
        <button class="secondary sm" id="btn-add-token-header" style="margin-top:5px">+ Header</button>
      </details>

      <details style="margin-top:6px">
        <summary>Parâmetros extras do body de token</summary>
        <div id="token-params-rows"></div>
        <button class="secondary sm" id="btn-add-token-param" style="margin-top:5px">+ Parâmetro</button>
      </details>

      <label style="margin-top:8px">JSONPath do token na resposta</label>
      <input id="token-path" value="$.access_token" />
      <label>JSONPath de expiração (opcional)</label>
      <input id="expires-path" placeholder="$.expires_in" />
    </div>

    <hr class="divider" />

    <!-- Chat -->
    <h3>Endpoint de Chat</h3>
    <label>URL (pode conter {{params.xxx}})</label>
    <input id="chat-url" placeholder="https://api.exemplo.com/v1/chat" />

    <label>Método HTTP</label>
    <select id="chat-method">
      <option value="POST">POST</option>
      <option value="GET">GET</option>
      <option value="PUT">PUT</option>
      <option value="PATCH">PATCH</option>
    </select>

    <details style="margin-top:8px">
      <summary>Headers do chat</summary>
      <div id="chat-headers-rows"></div>
      <button class="secondary sm" id="btn-add-chat-header" style="margin-top:5px">+ Header</button>
    </details>

    <label style="margin-top:8px">Template do body (JSON com {{prompt}})</label>
    <textarea id="body-template">{\n  "user_prompt": "{{prompt}}"\n}</textarea>

    <label>JSONPath da resposta (ex: $.message)</label>
    <input id="response-path" placeholder="$.message" />

    <label>JSONPath do session ID (opcional)</label>
    <input id="session-path" placeholder="$.message_id" />

    <!-- Auto-detected params -->
    <div id="params-section" style="display:none">
      <hr class="divider" />
      <h3>Parâmetros detectados ({{params.x}})</h3>
      <div id="params-rows"></div>
    </div>

    <hr class="divider" />

    <label>Modo de segurança</label>
    <select id="safety-mode">
      <option value="review">Review — intercepta sugestões para aprovação</option>
      <option value="read-only">Read-Only — apenas leitura, sem mutações</option>
      <option value="bypass">Bypass — envio direto sem travas</option>
    </select>

    <button id="btn-test" class="secondary">🔌 Testar conexão</button>
    <div id="test-result" style="display:none" class="msg"></div>

    <button id="btn-save">✅ Salvar provedor</button>
    <button id="btn-cancel" class="secondary" style="margin-top:4px">← Voltar</button>
    <div id="save-result" style="display:none" class="msg"></div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let params = {};

    // ── Auth descriptions ──────────────────────────────────────────
    const authDescriptions = {
      'none': 'A API é aberta — basta enviar o request direto.',
      'api-key': 'Uma chave fixa é enviada em um header a cada chamada (ex: Authorization: Bearer xxx).',
      'oauth2-client-credentials': 'Faz POST no endpoint de token com grant_type + client_id + client_secret, obtém um Bearer token e usa no header do chat. O token é renovado automaticamente quando expira.',
    };
    function updateAuthFields() {
      const type = document.getElementById('auth-type').value;
      document.getElementById('auth-desc').textContent = authDescriptions[type] ?? '';
      document.getElementById('fields-api-key').style.display = type === 'api-key' ? 'block' : 'none';
      document.getElementById('fields-oauth2').style.display = type === 'oauth2-client-credentials' ? 'block' : 'none';
    }
    document.getElementById('auth-type').addEventListener('change', updateAuthFields);

    // ── Credential warnings ────────────────────────────────────────
    function checkWarning(inputId, warnId) {
      const val = document.getElementById(inputId).value;
      document.getElementById(warnId).style.display = val && !val.startsWith('\${') ? 'block' : 'none';
    }
    document.getElementById('api-key').addEventListener('input', () => checkWarning('api-key', 'api-key-warning'));
    document.getElementById('client-secret').addEventListener('input', () => checkWarning('client-secret', 'secret-warning'));

    // ── KV row helpers ─────────────────────────────────────────────
    function addKvRow(containerId, key = '', value = '') {
      const row = document.createElement('div');
      row.className = 'kv-row';
      row.innerHTML = \`<input class="kv-key" placeholder="chave" value="\${escHtml(key)}" /><input class="kv-val" placeholder="valor" value="\${escHtml(value)}" /><button class="secondary sm" onclick="this.parentElement.remove()">✕</button>\`;
      document.getElementById(containerId).appendChild(row);
    }
    function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
    function readKvRows(containerId) {
      const rows = {};
      document.getElementById(containerId).querySelectorAll('.kv-row').forEach(row => {
        const k = row.querySelector('.kv-key').value.trim();
        const v = row.querySelector('.kv-val').value;
        if (k) rows[k] = v;
      });
      return rows;
    }
    document.getElementById('btn-add-token-header').addEventListener('click', () => addKvRow('token-headers-rows'));
    document.getElementById('btn-add-token-param').addEventListener('click', () => addKvRow('token-params-rows'));
    document.getElementById('btn-add-chat-header').addEventListener('click', () => addKvRow('chat-headers-rows'));

    // ── Auto-detect {{params.x}} ───────────────────────────────────
    function detectParams(text) {
      return [...new Set([...text.matchAll(/\\{\\{params\\.([^}]+)\\}\\}/g)].map(m => m[1]))];
    }
    function refreshParamSection() {
      const keys = detectParams(
        document.getElementById('chat-url').value +
        document.getElementById('body-template').value
      );
      const section = document.getElementById('params-section');
      const rows = document.getElementById('params-rows');
      if (!keys.length) { section.style.display = 'none'; return; }
      section.style.display = 'block';
      // keep existing values
      const existing = readKvRows('params-rows');
      rows.innerHTML = '';
      for (const k of keys) {
        const row = document.createElement('div');
        row.className = 'kv-row';
        const val = params[k] ?? existing[k] ?? '';
        row.innerHTML = \`<span style="flex:1;font-size:11px;color:var(--vscode-descriptionForeground)">\${escHtml(k)}</span><input style="flex:2" value="\${escHtml(val)}" data-key="\${escHtml(k)}" />\`;
        row.querySelector('input').addEventListener('input', e => { params[k] = e.target.value; });
        rows.appendChild(row);
      }
    }
    document.getElementById('chat-url').addEventListener('input', refreshParamSection);
    document.getElementById('body-template').addEventListener('input', refreshParamSection);

    // ── cURL import ────────────────────────────────────────────────
    function parseCurlClient(raw) {
      // Minimal client-side cURL parser (mirrors server-side one)
      const input = raw.replace(/\\\\\\n/g,' ').replace(/\\\\\\r\\n/g,' ').trim();
      const tokens = tokeniseCurl(input);
      let url='', method='', headers={}, bodyParts=[];
      let i = 1;
      while (i < tokens.length) {
        const t = tokens[i];
        if (t==='-X'||t==='--request') { method=tokens[++i]||method; }
        else if (t==='-H'||t==='--header') { const h=tokens[++i]||''; const c=h.indexOf(':'); if(c>-1) headers[h.slice(0,c).trim()]=h.slice(c+1).trim(); }
        else if (t==='-d'||t==='--data'||t==='--data-raw') { bodyParts.push(tokens[++i]||''); }
        else if (t==='--url') { url=tokens[++i]||''; }
        else if (!t.startsWith('-') && !url) { url=t; }
        i++;
      }
      if (!method) method = bodyParts.length ? 'POST' : 'GET';
      return { url, method, headers, body: bodyParts.join('&')||null };
    }
    function tokeniseCurl(input) {
      const tokens=[]; let cur='', i=0;
      while(i<input.length){
        const ch=input[i];
        if(ch==="'"){i++;while(i<input.length&&input[i]!=="'")cur+=input[i++];i++;}
        else if(ch==='"'){i++;while(i<input.length&&input[i]!=='"'){if(input[i]==='\\\\'&&i+1<input.length){i++;cur+=input[i++];}else cur+=input[i++];}i++;}
        else if(ch===' '||ch==='\\t'){if(cur){tokens.push(cur);cur='';}i++;}
        else{cur+=ch;i++;}
      }
      if(cur)tokens.push(cur);
      return tokens;
    }

    function applyParsedToAuth(parsed) {
      if (!parsed.url) return;
      document.getElementById('token-url').value = parsed.url;
      document.getElementById('auth-type').value = 'oauth2-client-credentials';
      updateAuthFields();
      // Try to detect grant_type from body
      if (parsed.body) {
        const params = new URLSearchParams(parsed.body);
        const gt = params.get('grant_type');
        if (gt) document.getElementById('grant-type').value = gt;
        const cid = params.get('client_id');
        if (cid) document.getElementById('client-id').value = cid;
        const cs = params.get('client_secret');
        if (cs) document.getElementById('client-secret').value = cs;
        // remaining params
        document.getElementById('token-params-rows').innerHTML = '';
        for (const [k,v] of params.entries()) {
          if (!['grant_type','client_id','client_secret'].includes(k)) addKvRow('token-params-rows', k, v);
        }
      }
      // Extra headers (skip Content-Type — it's automatic)
      document.getElementById('token-headers-rows').innerHTML = '';
      for (const [k,v] of Object.entries(parsed.headers)) {
        if (k.toLowerCase() !== 'content-type') addKvRow('token-headers-rows', k, v);
      }
    }

    function applyParsedToChat(parsed) {
      if (!parsed.url) return;
      document.getElementById('chat-url').value = parsed.url;
      document.getElementById('chat-method').value = parsed.method || 'POST';
      // Headers
      document.getElementById('chat-headers-rows').innerHTML = '';
      for (const [k,v] of Object.entries(parsed.headers)) {
        if (k.toLowerCase() !== 'content-type') addKvRow('chat-headers-rows', k, v);
      }
      // Body template
      if (parsed.body) {
        try {
          // Pretty-print JSON, inject {{prompt}} hint if missing
          const obj = JSON.parse(parsed.body);
          let pretty = JSON.stringify(obj, null, 2);
          if (!pretty.includes('{{prompt}}')) {
            // Find first string value and suggest replacing it
            pretty = pretty.replace(/"([^"]{0,80})"(\s*[:,])/, '"{{prompt}}"$2');
          }
          document.getElementById('body-template').value = pretty;
        } catch {
          document.getElementById('body-template').value = parsed.body;
        }
        refreshParamSection();
      }
    }

    document.getElementById('btn-import-auth').addEventListener('click', () => {
      const raw = document.getElementById('curl-auth-input').value.trim();
      if (!raw) return;
      try {
        applyParsedToAuth(parseCurlClient(raw));
        showCurlResult('✅ Auth preenchido a partir do cURL', true);
      } catch(e) { showCurlResult('❌ ' + e.message, false); }
    });
    document.getElementById('btn-import-chat').addEventListener('click', () => {
      const raw = document.getElementById('curl-auth-input').value.trim();
      if (!raw) return;
      try {
        applyParsedToChat(parseCurlClient(raw));
        showCurlResult('✅ Chat preenchido a partir do cURL', true);
      } catch(e) { showCurlResult('❌ ' + e.message, false); }
    });
    function showCurlResult(msg, ok) {
      const el = document.getElementById('curl-result');
      el.style.display = 'block';
      el.className = 'msg ' + (ok ? 'ok' : 'err');
      el.textContent = msg;
    }

    // ── Build payload ──────────────────────────────────────────────
    function buildPayload() {
      const authType = document.getElementById('auth-type').value;
      let auth;
      if (authType === 'none') {
        auth = { type: 'none' };
      } else if (authType === 'api-key') {
        auth = {
          type: 'api-key',
          headerName: document.getElementById('header-name').value || 'Authorization',
          apiKey: document.getElementById('api-key').value,
        };
      } else {
        auth = {
          type: 'oauth2-client-credentials',
          tokenUrl: document.getElementById('token-url').value.trim(),
          grantType: document.getElementById('grant-type').value.trim() || 'client_credentials',
          clientId: document.getElementById('client-id').value,
          clientSecret: document.getElementById('client-secret').value,
          tokenHeaders: readKvRows('token-headers-rows'),
          tokenParams: readKvRows('token-params-rows'),
          tokenPath: document.getElementById('token-path').value || '$.access_token',
          expiresPath: document.getElementById('expires-path').value || undefined,
        };
      }
      const chatHeaders = readKvRows('chat-headers-rows');
      return {
        name: document.getElementById('name').value.trim(),
        auth,
        chat: {
          url: document.getElementById('chat-url').value.trim(),
          method: document.getElementById('chat-method').value,
          headers: chatHeaders,
          bodyTemplate: document.getElementById('body-template').value,
        },
        responsePath: document.getElementById('response-path').value.trim(),
        sessionPath: document.getElementById('session-path').value.trim() || undefined,
        params,
        safetyMode: document.getElementById('safety-mode').value,
      };
    }

    // ── Actions ────────────────────────────────────────────────────
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
      if (!payload.chat.bodyTemplate.includes('{{prompt}}')) {
        alert('O body template deve conter {{prompt}}.');
        return;
      }
      vscode.postMessage({ type: 'save', payload });
    });

    document.getElementById('btn-new').addEventListener('click', () => {
      document.getElementById('list-view').style.display = 'none';
      document.getElementById('form-view').style.display = 'block';
      updateAuthFields();
    });
    document.getElementById('btn-cancel').addEventListener('click', () => {
      document.getElementById('form-view').style.display = 'none';
      document.getElementById('list-view').style.display = 'block';
      document.getElementById('test-result').style.display = 'none';
      document.getElementById('save-result').style.display = 'none';
    });

    // ── Key card ───────────────────────────────────────────────────
    function renderKey(keySet, keyPreview) {
      const badge = document.getElementById('key-badge');
      const preview = document.getElementById('key-preview');
      const btnClear = document.getElementById('btn-clear-key');
      badge.textContent = keySet ? 'configurada' : 'não configurada';
      badge.className = 'badge ' + (keySet ? 'set' : 'unset');
      if (keySet && keyPreview) {
        preview.textContent = keyPreview;
        preview.style.display = 'block';
      } else {
        preview.style.display = 'none';
      }
      btnClear.style.display = keySet ? 'block' : 'none';
    }
    document.getElementById('btn-set-key').addEventListener('click', () => {
      vscode.postMessage({ type: 'setApiKey' });
    });
    document.getElementById('btn-clear-key').addEventListener('click', () => {
      if (confirm('Remover a chave do OpenRouter? O chat ficará bloqueado se não houver provedores custom.')) {
        vscode.postMessage({ type: 'clearApiKey' });
      }
    });

    // ── Agents list ────────────────────────────────────────────────
    const BUILTIN_PROVIDERS = ['openai','anthropic','google','mistral','openrouter','custom'];
    function renderAgents(agents) {
      const el = document.getElementById('agents-list');
      const configured = (agents || []).filter(a => a.provider !== 'custom');
      if (!configured.length) {
        el.innerHTML = '<div class="empty">Nenhum agente customizado salvo em ~/.polypus/config.json</div>';
        return;
      }
      el.innerHTML = configured.map(a => \`
        <div class="row">
          <div class="row-info">
            <div class="row-title">\${escHtml(a.name)}</div>
            <div class="row-sub">\${escHtml(a.provider)} · \${escHtml(a.model)}\${a.isDefault ? ' · padrão' : ''}</div>
          </div>
          <button data-rm-agent="\${escHtml(a.name)}" class="secondary sm" title="Remover agente">✕</button>
        </div>
      \`).join('');
      el.querySelectorAll('[data-rm-agent]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (confirm('Remover agente "' + btn.dataset.rmAgent + '"?')) {
            vscode.postMessage({ type: 'removeAgent', name: btn.dataset.rmAgent });
          }
        });
      });
    }

    // ── Custom providers list ──────────────────────────────────────
    const safetyLabel = { bypass: 'bypass', 'read-only': 'read-only', review: 'review' };
    function renderCustom(providers) {
      const el = document.getElementById('custom-list');
      if (!providers.length) {
        el.innerHTML = '<div class="empty">Nenhum provedor custom configurado.</div>';
        return;
      }
      el.innerHTML = providers.map(p => \`
        <div class="row">
          <div class="row-info">
            <div class="row-title">🔌 \${escHtml(p.name)}</div>
            <div class="row-sub">\${escHtml(p.authType)} · modo \${escHtml(p.safetyMode)}</div>
          </div>
          <button data-remove="\${escHtml(p.name)}" class="secondary sm" title="Remover">✕</button>
        </div>
      \`).join('');
      el.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (confirm('Remover provedor "' + btn.dataset.remove + '"?')) {
            vscode.postMessage({ type: 'remove', name: btn.dataset.remove });
          }
        });
      });
    }

    // ── Message handler ────────────────────────────────────────────
    window.addEventListener('message', e => {
      const msg = e.data;
      if (msg.type === 'init' || msg.type === 'listResult') {
        renderKey(msg.keySet, msg.keyPreview);
        renderAgents(msg.agents);
        renderCustom(msg.providers);
      }
      if (msg.type === 'testResult') {
        const r = document.getElementById('test-result');
        r.className = 'msg ' + (msg.ok ? 'ok' : 'err');
        r.textContent = msg.message + (msg.reply ? '\\nResposta: ' + msg.reply : '');
      }
      if (msg.type === 'saveResult') {
        const r = document.getElementById('save-result');
        r.style.display = 'block';
        r.className = 'msg ' + (msg.ok ? 'ok' : 'err');
        r.textContent = msg.message;
        if (msg.ok) {
          vscode.postMessage({ type: 'list' });
          document.getElementById('form-view').style.display = 'none';
          document.getElementById('list-view').style.display = 'block';
        }
      }
      if (msg.type === 'removeResult' && msg.ok) vscode.postMessage({ type: 'list' });
    });

    vscode.postMessage({ type: 'ready' });
    updateAuthFields();
  </script>
</body>
</html>`;
  }
}
