import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { WSEvent } from "../shared/types";
import { Config, councilPointFor } from "../shared/config";
import { createAgentStore, type AgentStore } from "../server/agent-store";
import { createIssueStore, type IssueStore } from "../server/issue-store";
import { createCouncilState, type CouncilState } from "../server/council-state";
import { UNABLE_TO_RESPOND } from "../server/council/engine";
import { PERSONAS } from "../server/council/personas";
import { attachDebateTrigger } from "../server/council/debate-trigger";

const SECRET = "gsk_test_secret_do_not_leak_9f3a";

const dirs: string[] = [];
afterAll(() => dirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

interface Harness {
  agentStore: AgentStore;
  issueStore: IssueStore;
  council: CouncilState;
  broadcast: ReturnType<typeof vi.fn>;
}

function startHarness(): Harness {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentrift-debate-"));
  dirs.push(dir);
  const agentStore = createAgentStore(dir);
  const issueStore = createIssueStore(dir);
  const council = createCouncilState(Config.issueThreshold);
  const broadcast = vi.fn((_event: WSEvent) => {});
  attachDebateTrigger({ agentStore, issueStore, council, broadcast });
  return { agentStore, issueStore, council, broadcast };
}

const ok = () =>
  new Response(JSON.stringify({ choices: [{ message: { content: "A reply." } }] }), { status: 200 });

let fetchMock: ReturnType<typeof vi.fn>;

function stubFetch(impl: (call: number) => Promise<Response>): void {
  let calls = 0;
  fetchMock = vi.fn((_url: string, _init: RequestInit) => impl(++calls));
  vi.stubGlobal("fetch", fetchMock);
}

/** Clear the target at the agent's council seat — exactly what the client's arrival PUT does. */
function arrive(agentStore: AgentStore, id: string): void {
  // Coordinates only: a Station carries an id, and the store rejects anything
  // but exactly {x, y}.
  const agent = agentStore.getById(id)!;
  const { x, y } = councilPointFor(agent.stationId)!;
  agentStore.update(id, { position: { x, y }, target: null });
}

function arriveAllButLast(agentStore: AgentStore): void {
  const ids = agentStore.getAll().map((agent) => agent.id);
  for (const id of ids.slice(0, -1)) arrive(agentStore, id);
}

/** Simulate the issues route crossing the threshold. */
function cross(h: Harness): void {
  h.council.notify(Config.issueThreshold);
}

/** The async trigger settles a few microtasks after the store update. */
const debateCalls = (broadcast: ReturnType<typeof vi.fn>) =>
  broadcast.mock.calls.filter((call) => (call[0] as WSEvent).type === "council:debate");

/** Error objects stringify to {} — spell them out or the assertion passes empty. */
function serializeLogs(spy: unknown): string {
  const calls = (spy as { mock: { calls: unknown[][] } }).mock.calls;
  return calls
    .map((call) => call.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : String(a))).join(" "))
    .join("\n");
}

beforeEach(() => {
  vi.stubEnv("GROQ_API_KEY", SECRET);
  // The trigger logs; a test run should not spray the terminal.
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("debate trigger", () => {
  it("fires once, with all four personas, when the last agent arrives", async () => {
    stubFetch(async () => ok());
    const h = startHarness();
    cross(h);

    arriveAllButLast(h.agentStore);
    await Promise.resolve();
    expect(debateCalls(h.broadcast)).toHaveLength(0);

    const last = h.agentStore.getAll().at(-1)!;
    arrive(h.agentStore, last.id);

    await vi.waitFor(() => expect(debateCalls(h.broadcast)).toHaveLength(1));
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(debateCalls(h.broadcast)[0][0]).toEqual({
      type: "council:debate",
      payload: PERSONAS.map((persona) => ({ persona: persona.name, message: "A reply." })),
    });
  });

  it("does not run a second debate for the same session", async () => {
    stubFetch(async () => ok());
    const h = startHarness();
    cross(h);
    for (const agent of h.agentStore.getAll()) arrive(h.agentStore, agent.id);

    await vi.waitFor(() => expect(debateCalls(h.broadcast)).toHaveLength(1));

    // Further updates while the latch is still active — a late arrival report,
    // an unrelated status change — must not start another debate.
    for (const agent of h.agentStore.getAll()) arrive(h.agentStore, agent.id);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(debateCalls(h.broadcast)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("re-arms off the latch clear: a fresh crossing debates again", async () => {
    stubFetch(async () => ok());
    const h = startHarness();
    cross(h);
    for (const agent of h.agentStore.getAll()) arrive(h.agentStore, agent.id);
    await vi.waitFor(() => expect(debateCalls(h.broadcast)).toHaveLength(1));

    // Existing behaviour, untouched: the falling edge sends everyone home.
    h.council.notify(0);
    for (const agent of h.agentStore.getAll()) {
      const station = Config.stations.find((s) => s.id === agent.stationId)!;
      h.agentStore.update(agent.id, {
        target: { x: station.x, y: station.y },
        status: "walking",
      });
    }

    cross(h);
    for (const agent of h.agentStore.getAll()) arrive(h.agentStore, agent.id);

    await vi.waitFor(() => expect(debateCalls(h.broadcast)).toHaveLength(2));
  });

  it("stays quiet while the latch is inactive, even with everyone at the point", async () => {
    stubFetch(async () => ok());
    const h = startHarness();
    for (const agent of h.agentStore.getAll()) arrive(h.agentStore, agent.id);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(debateCalls(h.broadcast)).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("broadcasts four entries, with the failed persona marked, when one call dies", async () => {
    stubFetch(async (call) =>
      call === 3 ? new Response("unauthorized", { status: 401 }) : ok(),
    );
    const h = startHarness();
    cross(h);
    for (const agent of h.agentStore.getAll()) arrive(h.agentStore, agent.id);

    await vi.waitFor(() => expect(debateCalls(h.broadcast)).toHaveLength(1));
    const payload = (debateCalls(h.broadcast)[0][0] as { payload: { message: string }[] }).payload;
    expect(payload).toHaveLength(4);
    expect(payload[2].message).toBe(UNABLE_TO_RESPOND);
  });

  it("never lets the API key reach a broadcast payload or a log line", async () => {
    // A 401 body echoing the key is the pessimistic case: if it can leak, it does.
    stubFetch(async () => new Response(`unauthorized key=${SECRET}`, { status: 401 }));
    const h = startHarness();
    cross(h);
    for (const agent of h.agentStore.getAll()) arrive(h.agentStore, agent.id);

    await vi.waitFor(() => expect(debateCalls(h.broadcast)).toHaveLength(1));

    expect(JSON.stringify(h.broadcast.mock.calls)).not.toContain(SECRET);
    for (const spy of [console.log, console.error, console.warn]) {
      expect(serializeLogs(spy)).not.toContain(SECRET);
    }
  });

  it("broadcasts nothing when the key is missing, and does not throw", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    stubFetch(async () => ok());
    const h = startHarness();
    cross(h);
    for (const agent of h.agentStore.getAll()) arrive(h.agentStore, agent.id);

    await vi.waitFor(() => expect(debateCalls(h.broadcast)).toHaveLength(1));
    const payload = (debateCalls(h.broadcast)[0][0] as { payload: { message: string }[] }).payload;
    expect(payload.every((entry) => entry.message === UNABLE_TO_RESPOND)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
