import type { WSEvent } from "../../shared/types";

// Single source for the server origin.
const SERVER_URL = "http://localhost:3000";
const WS_URL = SERVER_URL.replace(/^http/, "ws");

const RETRY_START_MS = 1000;
const RETRY_MAX_MS = 10000;

export type SocketState = "connected" | "retrying" | "disconnected";

export interface GameSocket {
  readonly state: SocketState;
  close(): void;
}

export interface SocketHandlers {
  onEvent: (event: WSEvent) => void;
  onState: (state: SocketState) => void;
}

export function connectSocket(handlers: SocketHandlers): GameSocket {
  let state: SocketState = "disconnected";
  let ws = new WebSocket(WS_URL);
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let retryMs = RETRY_START_MS;
  let closed = false;

  function setState(next: SocketState): void {
    if (state === next) return;
    state = next;
    handlers.onState(next);
  }

  function listen(socket: WebSocket): void {
    socket.addEventListener("open", () => {
      retryMs = RETRY_START_MS; // backoff resets on a healthy connection
      setState("connected");
    });
    socket.addEventListener("close", () => {
      if (closed) return;
      setState("retrying");
      retryTimer = setTimeout(reconnect, retryMs);
      retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
    });
    socket.addEventListener("error", () => {
      // close always follows an error; the close handler schedules the retry.
      if (!closed) setState("disconnected");
    });
    socket.addEventListener("message", (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      let parsed: WSEvent;
      try {
        parsed = JSON.parse(event.data) as WSEvent;
      } catch (err) {
        console.warn("[socket] unparseable message, ignored:", event.data, err);
        return;
      }
      handlers.onEvent(parsed);
    });
  }

  function reconnect(): void {
    if (closed) return;
    ws = new WebSocket(WS_URL);
    listen(ws);
  }

  listen(ws);

  return {
    get state(): SocketState {
      return state;
    },
    close: () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      ws.close();
    },
  };
}

/**
 * The client moved the agent, so the client reports where it ended up —
 * position plus a cleared target, which the store reads as "I have arrived".
 */
export function reportAgentArrival(id: string, point: { x: number; y: number }): void {
  fetch(`${SERVER_URL}/api/agents/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      position: { x: Math.round(point.x), y: Math.round(point.y) },
      target: null,
    }),
  }).catch((err) => console.warn("[walk] arrival report failed", err));
}
