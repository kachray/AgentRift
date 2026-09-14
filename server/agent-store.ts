import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import type { Agent } from "../shared/types";
import { Config } from "../shared/config";

const AGENTS_FILE = "agents.json";
const ALLOWED_KEYS = new Set<string>([
  "name",
  "stationId",
  "position",
  "target",
  "status",
  "currentTask",
]);
const STATUSES = new Set<string>(["idle", "walking", "working", "thinking", "at_council"]);

export interface AgentStore {
  getAll(): Agent[];
  getById(id: string): Agent | undefined;
  update(id: string, partial: Partial<Agent>): Agent | undefined;
  events: EventEmitter;
}

function seedAgents(): Agent[] {
  const names = ["Ada", "Grace", "Alan", "Katherine", "Dennis"];
  return Config.stations.map((station, i) => ({
    id: names[i].toLowerCase(),
    name: names[i],
    stationId: station.id,
    position: { x: station.x, y: station.y },
    target: null,
    status: "idle" as const,
    currentTask: null,
  }));
}

function validatePartial(partial: Partial<Agent>): void {
  for (const key of Object.keys(partial)) {
    if (!ALLOWED_KEYS.has(key)) throw new TypeError(`unknown agent field: ${key}`);
  }
  if (partial.status !== undefined && !STATUSES.has(partial.status)) {
    throw new TypeError(`invalid status: ${partial.status}`);
  }
  if (partial.position !== undefined) {
    const { x, y } = partial.position as { x: unknown; y: unknown };
    if (typeof x !== "number" || typeof y !== "number") {
      throw new TypeError("position must be {x, y} numbers");
    }
  }
  // null is valid here: it means "not walking anywhere". position has no such case.
  if (partial.target !== undefined && partial.target !== null) {
    const { x, y } = partial.target as { x: unknown; y: unknown };
    if (typeof x !== "number" || typeof y !== "number") {
      throw new TypeError("target must be {x, y} numbers or null");
    }
  }
}

export function createAgentStore(dataDir: string): AgentStore {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, AGENTS_FILE);
  const agents = new Map<string, Agent>();
  const events = new EventEmitter();

  function persist(): void {
    fs.writeFileSync(file, JSON.stringify([...agents.values()], null, 2));
  }

  if (fs.existsSync(file)) {
    for (const agent of JSON.parse(fs.readFileSync(file, "utf8")) as Agent[]) {
      agents.set(agent.id, agent);
    }
  } else {
    for (const agent of seedAgents()) agents.set(agent.id, agent);
    persist();
  }

  return {
    getAll: () => [...agents.values()],
    getById: (id) => agents.get(id),
    update(id, partial) {
      const agent = agents.get(id);
      if (!agent) return undefined;
      validatePartial(partial);
      const updated: Agent = { ...agent, ...partial };
      agents.set(id, updated);
      persist();
      events.emit("update", updated);
      return updated;
    },
    events,
  };
}
