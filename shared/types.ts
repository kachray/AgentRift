export interface Station {
  id: string;
  x: number;
  y: number;
}

export interface Agent {
  id: string;
  name: string;
  stationId: string;
  position: { x: number; y: number };
  target: { x: number; y: number } | null;
  status: "idle" | "walking" | "working" | "thinking" | "at_council";
  currentTask: string | null;
}

export interface Issue {
  id: string;
  title: string;
  severity: "low" | "medium" | "high";
  createdAt: string; // ISO 8601
  resolved: boolean;
  ownerAgentId: string | null;
}

export interface Config {
  tileSize: number;
  canvasWidth: number;
  canvasHeight: number;
  issueThreshold: number;
  stations: Station[];
  meetingPoint: Station;
}

/**
 * One persona's contribution to a council debate. The four personas are their own
 * cast, not the five walking agents, so nothing here ties a message to an agent id.
 */
export interface DebateMessage {
  persona: string;
  /** Response text, or the "(unable to respond)" sentinel when the call failed. */
  message: string;
}

export type WSEvent =
  | { type: "agent:update"; payload: Agent }
  | { type: "agent:list"; payload: Agent[] }
  | { type: "issue:created"; payload: Issue }
  | { type: "issue:updated"; payload: Issue }
  | { type: "council:triggered"; payload: { unresolvedCount: number; threshold: number } }
  | { type: "council:debate"; payload: DebateMessage[] };
