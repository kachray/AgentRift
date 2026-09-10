import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { WSEvent } from "../shared/types";
import type { AgentStore } from "./agent-store";
import type { IssueStore } from "./issue-store";

export interface WsHub {
  broadcast(event: WSEvent): void;
}

export function createWsHub(server: Server, agentStore: AgentStore, issueStore: IssueStore): WsHub {
  const wss = new WebSocketServer({ server });

  function broadcast(event: WSEvent): void {
    const message = JSON.stringify(event);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    }
  }

  wss.on("connection", (socket) => {
    socket.send(JSON.stringify({ type: "agent:list", payload: agentStore.getAll() }));
  });

  agentStore.events.on("update", (agent) => broadcast({ type: "agent:update", payload: agent }));
  issueStore.events.on("created", (issue) => broadcast({ type: "issue:created", payload: issue }));
  issueStore.events.on("resolved", (issue) => broadcast({ type: "issue:updated", payload: issue }));

  return { broadcast };
}
