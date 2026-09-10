import type { WSEvent } from "../../shared/types";

// Single source for the socket URL.
const WS_URL = "ws://localhost:3000";

export type SocketState = "connected" | "disconnected";

export interface GameSocket {
  readonly state: SocketState;
  close(): void;
}

export interface SocketHandlers {
  onEvent: (event: WSEvent) => void;
  onState: (state: SocketState) => void;
}

export function connectSocket(handlers: SocketHandlers): GameSocket {
  const ws = new WebSocket(WS_URL);
  let state: SocketState = "disconnected";

  function setState(next: SocketState): void {
    if (state === next) return;
    state = next;
    handlers.onState(next);
  }

  ws.addEventListener("open", () => setState("connected"));
  ws.addEventListener("close", () => setState("disconnected"));
  ws.addEventListener("error", () => setState("disconnected"));

  ws.addEventListener("message", (event: MessageEvent) => {
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

  return {
    get state(): SocketState {
      return state;
    },
    close: () => ws.close(),
  };
}
