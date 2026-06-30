/**
 * Service Worker (background) — gerencia WebSocket, estado da sessão,
 * e roteia mensagens entre popup, side panel e content script.
 *
 * Fluxo:
 *   1. Conecta em ws://localhost:9876 (padrão) com backoff exponencial
 *   2. Popup/side panel enviam { type: "run", task, mode }
 *   3. Background encaminha como mensagem WebSocket ao CLI
 *   4. Eventos NDJSON do CLI são repassados a todas as UIs
 *   5. Respostas (confirm, ask) voltam via WebSocket
 */
import type { ConnectionStatus, StreamEvent, WsCommand, BgToUi, UiToBg } from "../shared/types.js";

/* ─── Estado ─── */

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000; // 30s
const WS_PORT = 9876;

let connectionStatus: ConnectionStatus = "disconnected";
let sessionId: string | null = null;
let sessionTask: string | null = null;

/** Chave no chrome.storage.local para a sessão ativa */
const STORAGE_KEY = "polypus_session";

/* ─── Broadcast para todas as UIs ─── */

function broadcast(msg: BgToUi): void {
  chrome.runtime.sendMessage(msg).catch(() => {
    /* Nenhuma UI ouvindo — ignorar */
  });
}

function setStatus(status: ConnectionStatus): void {
  connectionStatus = status;
  broadcast({ type: "status", status });
  updateBadge(status);
}

function updateBadge(status: ConnectionStatus): void {
  const text =
    status === "connected" ? "🐙" :
    status === "connecting" ? "⋯" :
    status === "error" ? "✗" : "";
  const color =
    status === "connected" ? "#4ade80" :
    status === "connecting" ? "#fbbf24" :
    status === "error" ? "#ef4444" : "#666";

  void chrome.action.setBadgeText({ text });
  void chrome.action.setBadgeBackgroundColor({ color });
}

/* ─── WebSocket ─── */

function connect(): void {
  if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;

  setStatus("connecting");
  ws = new WebSocket(`ws://127.0.0.1:${WS_PORT}`);

  ws.onopen = () => {
    setStatus("connected");
    reconnectAttempts = 0;
  };

  ws.onmessage = (event) => {
    try {
      const line = event.data as string;
      if (!line.trim()) return;
      const ev = JSON.parse(line) as StreamEvent;

      // Track session ID
      if (ev.type === "session_start") {
        sessionId = ev.sessionId;
        broadcast({ type: "session", sessionId });
        persistSession();
      }
      if (ev.type === "end") {
        // Keep sessionId for resume (user can resume with --continue)
        updateBadge(connectionStatus);
      }

      broadcast({ type: "event", event: ev });
    } catch {
      // Ignorar linhas não-JSON
    }
  };

  ws.onerror = () => {
    setStatus("error");
  };

  ws.onclose = () => {
    if (ws) ws = null;
    setStatus("disconnected");
    scheduleReconnect();
  };
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  const delay = Math.min(1000 * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY);
  reconnectAttempts++;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function sendWs(msg: WsCommand): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    broadcast({ type: "event", event: { type: "error", message: "WebSocket not connected." } });
  }
}

/* ─── Message handler (popup / side panel → bg) ─── */

/* ─── Persistência de sessão (RF6) ─── */

interface PersistedSession {
  sessionId: string;
  task: string;
  timestamp: number;
}

async function persistSession(): Promise<void> {
  if (!sessionId) return;
  const data: PersistedSession = {
    sessionId,
    task: sessionTask ?? "",
    timestamp: Date.now(),
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}

async function loadPersistedSession(): Promise<PersistedSession | null> {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  return (raw[STORAGE_KEY] as PersistedSession) ?? null;
}

async function clearPersistedSession(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
  sessionId = null;
  sessionTask = null;
}

/** Restaura a sessão anterior se ainda for recente (< 30 min). */
async function maybeRestoreSession(): Promise<void> {
  if (sessionId) return; // já conectado
  const saved = await loadPersistedSession();
  if (!saved) return;
  const age = Date.now() - saved.timestamp;
  if (age > 30 * 60 * 1000) {
    // Sessão expirada (>30 min)
    await clearPersistedSession();
    return;
  }
  sessionId = saved.sessionId;
  sessionTask = saved.task;
  updateBadge(connectionStatus);
}

/* ─── Message handler (popup / side panel → bg) ─── */

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  const m = msg as Record<string, unknown>;
  switch (m.type) {
    case "get_status":
      sendResponse({
        status: connectionStatus,
        sessionId,
        sessionTask: sessionTask,
        canResume: !!sessionId,
      });
      return true;

    case "run": {
      const task = m.task as string;
      sessionTask = task;
      sendWs({
        type: "run",
        task,
        mode: (m.mode as WsCommand["mode"]) ?? "review",
      });
      return false;
    }

    case "stop":
      sendWs({ type: "stop" });
      return false;

    case "respond_ask":
      sendWs({
        type: "respond_ask",
        id: m.id as number,
        selected: m.selected as string[] | null,
      });
      return false;

    case "respond_confirm":
      sendWs({
        type: "respond_confirm",
        id: m.id as number,
        approved: m.approved as boolean,
      });
      return false;
  }
  return false;
});

/* ─── Init ─── */

// Conecta automaticamente ao iniciar e restaura sessão
connect();
void maybeRestoreSession();

// Reconecta quando o chrome fica online (volta de suspensão)
chrome.runtime.onStartup?.addListener(() => {
  connect();
  void maybeRestoreSession();
});