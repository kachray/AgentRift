export interface Agent {
  id: string;
  name: string;
}

export interface Issue {
  id: string;
  title: string;
}

export type WSEvent =
  | { type: "agent:update"; payload: Agent }
  | { type: "issue:update"; payload: Issue };
