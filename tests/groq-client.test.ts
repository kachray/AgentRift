import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import { chat } from "../server/council/groq-client";

const SECRET = "gsk_test_secret_do_not_leak_9f3a";

const ok = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

/** The exact object AbortSignal.timeout rejects with. */
const timeoutError = () => new DOMException("The operation was aborted", "TimeoutError");

let fetchMock: ReturnType<typeof vi.fn>;

function stubFetch(impl: () => Promise<Response>): void {
  // Typed parameters, not a bare vi.fn(): the assertions below index into the
  // recorded call, and a zero-arg mock types calls[0] as an empty tuple.
  fetchMock = vi.fn((_url: string, _init: RequestInit) => impl());
  vi.stubGlobal("fetch", fetchMock);
}

// Last call, not first: the model test asserts two calls in one test.
const lastCall = () => fetchMock.mock.calls.at(-1)!;
const sentBody = () => JSON.parse(lastCall()[1].body as string);
const sentHeaders = () => lastCall()[1].headers as unknown as Record<string, string>;

beforeEach(() => {
  vi.stubEnv("GROQ_API_KEY", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const ask = () => chat({ systemPrompt: "system", userMessage: "context" });

/** The rejection from ask(), with its type kept — ask() resolves a string. */
async function failure(): Promise<Error> {
  try {
    await ask();
  } catch (err) {
    return err as Error;
  }
  throw new Error("expected chat() to reject");
}

describe("groq-client", () => {
  it("returns the response text on success", async () => {
    stubFetch(async () => ok("Reactor first."));
    expect(await ask()).toBe("Reactor first.");
  });

  it("sends the system prompt and user message as an OpenAI-style pair", async () => {
    stubFetch(async () => ok("fine"));
    await ask();
    expect(sentBody().messages).toEqual([
      { role: "system", content: "system" },
      { role: "user", content: "context" },
    ]);
  });

  it("throws a clear error when the API key is missing", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    stubFetch(async () => ok("unused"));
    await expect(ask()).rejects.toThrow(/GROQ_API_KEY is not set/);
    // Nothing was attempted, so no request could have carried a key.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws with the status and Groq's body on a non-200", async () => {
    stubFetch(async () => new Response('{"error":{"message":"rate limited"}}', { status: 429 }));
    await expect(ask()).rejects.toThrow(/429.*rate limited/s);
  });

  it("truncates a long error body so it never lands whole in a log", async () => {
    stubFetch(async () => new Response("x".repeat(5000), { status: 502 }));
    const err = await failure();
    expect(err.message.length).toBeLessThan(600);
  });

  it("reports a timeout distinctly from a network failure", async () => {
    stubFetch(async () => {
      throw timeoutError();
    });
    await expect(ask()).rejects.toThrow(/timed out after 15000ms/);
  });

  it("reports a network failure with the original error as its cause", async () => {
    const cause = new TypeError("fetch failed");
    stubFetch(async () => {
      throw cause;
    });
    const err = await failure();
    expect(err.message).toMatch(/network error/);
    expect(err.cause).toBe(cause);
  });

  it("throws rather than returning blank content", async () => {
    stubFetch(async () => ok("   "));
    await expect(ask()).rejects.toThrow(/no message content/);
  });

  it("throws when the response shape is wrong", async () => {
    stubFetch(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    await expect(ask()).rejects.toThrow(/no message content/);
  });

  it("defaults the model and honours GROQ_MODEL, in one place", async () => {
    stubFetch(async () => ok("fine"));
    await ask();
    expect(sentBody().model).toBe("openai/gpt-oss-120b");

    vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-20b");
    await ask();
    expect(sentBody().model).toBe("openai/gpt-oss-20b");
  });

  it("falls back to the default model on an empty GROQ_MODEL", async () => {
    vi.stubEnv("GROQ_MODEL", "");
    stubFetch(async () => ok("fine"));
    await ask();
    expect(sentBody().model).toBe("openai/gpt-oss-120b");
  });

  // The positive control for every "never leaks" assertion: the key IS used,
  // so a test asserting it is absent from an error is not vacuously passing.
  it("sends the key in the Authorization header, and only there", async () => {
    stubFetch(async () => ok("fine"));
    await ask();
    expect(sentHeaders().Authorization).toBe(`Bearer ${SECRET}`);
    expect(sentHeaders()).toEqual({
      "Content-Type": "application/json",
      Authorization: `Bearer ${SECRET}`,
    });
    expect(sentBody()).not.toHaveProperty("api_key");
  });

  it("redacts the key if an upstream error body echoes it back", async () => {
    stubFetch(async () => new Response(`bad auth: Bearer ${SECRET} rejected`, { status: 401 }));
    const err = await failure();
    expect(err.message).not.toContain(SECRET);
    expect(err.message).toContain("[redacted]");
    // The rest of the body is the reason the message exists; keep it.
    expect(err.message).toContain("bad auth");
  });

  it("never puts the key in a thrown error", async () => {
    stubFetch(async () => new Response("unauthorized", { status: 401 }));
    const err = await failure();
    expect(err.message).not.toContain(SECRET);
    expect(String(err.stack)).not.toContain(SECRET);
  });

  it("has exactly one interpolation of the key in its source, the header", () => {
    const src = fs.readFileSync(new URL("../server/council/groq-client.ts", import.meta.url), "utf8");
    // A second one is how a key reaches a log line or an error message.
    expect(src.match(/\$\{key\}/g)).toHaveLength(1);
    expect(src).not.toMatch(/console\./);
  });
});
