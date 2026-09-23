import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import type { Agent } from "../shared/types";
import { Config, councilPointFor, withinEpsilon } from "../shared/config";

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

/** Seeded agent names, keyed by station id — never a parallel array to shift. */
const AGENT_NAMES: Readonly<Record<string, string>> = {
  lab: "Ada",
  forge: "Grace",
  garden: "Alan",
  library: "Katherine",
  commons: "Dennis",
};

function seedAgents(): Agent[] {
  return Config.stations.map((station) => {
    const name = AGENT_NAMES[station.id];
    if (!name) {
      throw new Error(
        `seedAgents: no name for station '${station.id}' — every station in Config.stations needs an entry in AGENT_NAMES`,
      );
    }
    return {
      id: name.toLowerCase(),
      name,
      stationId: station.id,
      position: { x: station.x, y: station.y },
      target: null,
      status: "idle" as const,
      currentTask: null,
    };
  });
}

/**
 * A point is exactly {x, y}. Extra keys are rejected, not ignored: Config's
 * Station carries an id and is the obvious thing to pass in by mistake, and an
 * object that survives validation gets persisted and broadcast as-is.
 */
function isPoint(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes("x") || !keys.includes("y")) return false;
  const { x, y } = value as { x: unknown; y: unknown };
  // isFinite, not just typeof: JSON has no NaN, so a NaN would round-trip to
  // null in the persisted file and walk the client sprite off the map.
  return Number.isFinite(x) && Number.isFinite(y);
}

function validatePartial(partial: Partial<Agent>): void {
  for (const key of Object.keys(partial)) {
    if (!ALLOWED_KEYS.has(key)) throw new TypeError(`unknown agent field: ${key}`);
  }
  if (partial.status !== undefined && !STATUSES.has(partial.status)) {
    throw new TypeError(`invalid status: ${partial.status}`);
  }
  if (partial.position !== undefined && !isPoint(partial.position)) {
    throw new TypeError("position must be {x, y} numbers");
  }
  // null is valid here: it means "not walking anywhere". position has no such case.
  if (partial.target !== undefined && partial.target !== null && !isPoint(partial.target)) {
    throw new TypeError("target must be {x, y} numbers or null");
  }
}

/**
 * A caller that clears the target has said "I have arrived" — where it arrived
 * decides the status. Derived here, not in the route, because every writer
 * (council trigger, council clear, the client's arrival PUT) goes through
 * update(); a rule held in one caller is a rule the others can break.
 *
 * Config is read now, not captured: a mid-walk retarget must never let a stale
 * arrival match the place it was aiming at.
 */
function deriveArrivalStatus(partial: Partial<Agent>, current: Agent): Partial<Agent> {
  if (partial.status !== undefined || partial.target !== null) return {};
  const position = partial.position ?? current.position;
  // The agent's own seat, not the bare meeting point: agents sit spread around
  // it now, and the seat comes from the same councilPointFor the retarget uses.
  const seat = councilPointFor(current.stationId);
  if (seat && withinEpsilon(position, seat)) return { status: "at_council" };
  const station = Config.stations.find((s) => s.id === current.stationId);
  if (station && withinEpsilon(position, station)) return { status: "idle" };
  return {}; // somewhere else entirely — don't guess
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
    try {
      for (const agent of JSON.parse(fs.readFileSync(file, "utf8")) as Agent[]) {
        agents.set(agent.id, agent);
      }
    } catch (err) {
      // A corrupt file must not take the server down at boot. The seed
      // overwrites it, so nothing of the unreadable file survives to re-break
      // the next boot.
      console.error(`agents.json is unreadable, seeding fresh agents: ${err instanceof Error ? err.message : err}`);
      for (const agent of seedAgents()) agents.set(agent.id, agent);
      persist();
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
      const updated: Agent = { ...agent, ...partial, ...deriveArrivalStatus(partial, agent) };
      agents.set(id, updated);
      persist();
      events.emit("update", updated);
      return updated;
    },
    events,
  };
}
