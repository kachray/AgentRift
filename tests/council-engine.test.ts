import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent, Issue } from "../shared/types";
import { PERSONAS } from "../server/council/personas";
import { UNABLE_TO_RESPOND, buildContext, runDebate } from "../server/council/engine";

const SECRET = "gsk_test_secret_do_not_leak_9f3a";

function agent(name: string, status: Agent["status"]): Agent {
  return {
    id: name.toLowerCase(),
    name,
    stationId: "lab",
    position: { x: 0, y: 0 },
    target: null,
    status,
    currentTask: null,
  };
}

function issue(title: string, severity: Issue["severity"], resolved = false): Issue {
  return {
    id: title,
    title,
    severity,
    createdAt: "2026-01-01T00:00:00.000Z",
    resolved,
    ownerAgentId: null,
  };
}

const AGENTS = ["Ada", "Grace", "Alan", "Katherine", "Dennis"].map((n) => agent(n, "at_council"));

const ok = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

let fetchMock: ReturnType<typeof vi.fn>;

function stubFetch(impl: (call: number) => Promise<Response>): void {
  let calls = 0;
  fetchMock = vi.fn((_url: string, _init: RequestInit) => impl(++calls));
  vi.stubGlobal("fetch", fetchMock);
}

/** The user message each call actually sent, for comparing contexts. */
function sentContext(call: [string, RequestInit]): string {
  const body = JSON.parse(call[1].body as string) as {
    messages: { role: string; content: string }[];
  };
  return body.messages.find((m) => m.role === "user")!.content;
}

/** Error objects stringify to {} — spell them out or the assertion passes empty. */
function serializeLogs(spy: unknown): string {
  const calls = (spy as { mock: { calls: unknown[][] } }).mock.calls;
  return calls
    .map((call) => call.map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : String(a))).join(" "))
    .join("\n");
}

beforeEach(() => {
  vi.stubEnv("GROQ_API_KEY", SECRET);
  // The engine reports failed personas; a test run should not spray the terminal.
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("personas", () => {
  it("is four voices that are actually different", () => {
    expect(PERSONAS).toHaveLength(4);
    expect(new Set(PERSONAS.map((p) => p.name)).size).toBe(4);
    // Four paraphrases of one voice would pass a length check and fail this.
    expect(new Set(PERSONAS.map((p) => p.systemPrompt)).size).toBe(4);
  });

  it("is its own cast, not the five walking agents", () => {
    const walkers = new Set(["Ada", "Grace", "Alan", "Katherine", "Dennis"]);
    for (const persona of PERSONAS) expect(walkers.has(persona.name)).toBe(false);
  });
});

describe("buildContext", () => {
  it("carries every unresolved issue with its severity, and no resolved one", () => {
    const ctx = buildContext(
      [issue("Reactor overheating", "high"), issue("Pump leak", "low", true)],
      AGENTS,
    );
    expect(ctx).toContain("Reactor overheating");
    expect(ctx).toContain("[high]");
    expect(ctx).not.toContain("Pump leak");
    expect(ctx).toContain("(1)");
  });

  it("carries the agent roster with statuses", () => {
    const ctx = buildContext([], AGENTS);
    for (const name of ["Ada", "Grace", "Alan", "Katherine", "Dennis"]) {
      expect(ctx).toContain(`${name} (at_council)`);
    }
    expect(ctx).toContain("(none outstanding)");
  });
});

describe("runDebate", () => {
  it("returns one entry per persona, in persona order", async () => {
    stubFetch(async (call) => ok(`reply ${call}`));
    const transcript = await runDebate([issue("Reactor overheating", "high")], AGENTS);
    expect(transcript.map((t) => t.persona)).toEqual(PERSONAS.map((p) => p.name));
    expect(transcript.every((t) => t.message.startsWith("reply"))).toBe(true);
  });

  it("hands every persona the same context, chained to nobody", async () => {
    stubFetch(async () => ok("fine"));
    await runDebate([issue("Reactor overheating", "high")], AGENTS);
    const contexts = fetchMock.mock.calls.map((call) => sentContext(call as [string, RequestInit]));
    expect(contexts).toHaveLength(4);
    expect(new Set(contexts).size).toBe(1);
    expect(contexts[0]).toContain("Reactor overheating");
    // A chained debate would feed earlier replies into later prompts.
    expect(contexts[3]).not.toContain("fine");
  });

  it("keeps the other three when one persona fails", async () => {
    stubFetch(async (call) =>
      call === 2 ? new Response("rate limited", { status: 429 }) : ok(`reply ${call}`),
    );
    const transcript = await runDebate([], AGENTS);
    expect(transcript).toHaveLength(4);
    expect(transcript[1]).toEqual({ persona: PERSONAS[1].name, message: UNABLE_TO_RESPOND });
    expect(transcript.filter((t) => t.message === UNABLE_TO_RESPOND)).toHaveLength(1);
  });

  it("survives all four failing", async () => {
    stubFetch(async () => {
      throw new TypeError("fetch failed");
    });
    const transcript = await runDebate([], AGENTS);
    expect(transcript.map((t) => t.message)).toEqual(Array(4).fill(UNABLE_TO_RESPOND));
  });

  // Sequential calls would await call 1 forever and time this test out.
  it("fires all four calls in parallel, not one after another", async () => {
    let calls = 0;
    const gates: (() => void)[] = [];
    stubFetch(async () => {
      calls++;
      return new Promise<Response>((resolve) => {
        gates.push(() => resolve(ok("fine")));
        if (calls === 4) gates.forEach((open) => open());
      });
    });

    await expect(runDebate([], AGENTS)).resolves.toHaveLength(4);
    expect(calls).toBe(4);
  }, 3000);

  it("says which persona failed and why, without the key", async () => {
    stubFetch(async () =>
      new Response('{"error":{"message":"model not found"}}', { status: 404 }),
    );
    await runDebate([], AGENTS);
    const logged = serializeLogs(console.error);
    expect(logged).toContain(PERSONAS[0].name);
    expect(logged).toContain("model not found");
    expect(logged).not.toContain(SECRET);
  });

  it("never leaks the key into a transcript when every call fails", async () => {
    stubFetch(async () => new Response(`unauthorized: ${SECRET}`, { status: 401 }));
    const transcript = await runDebate([], AGENTS);
    expect(JSON.stringify(transcript)).not.toContain(SECRET);
  });
});
