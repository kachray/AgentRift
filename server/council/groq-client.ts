import type { DebateMessage } from "../../shared/types";

const TIMEOUT_MS = 15_000;
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
/**
 * The only place the model id appears. Overridable because Groq retires models:
 * llama-3.3-70b-versatile was the original default and now 404s.
 */
const DEFAULT_MODEL = "openai/gpt-oss-120b";
/** Groq's error pages can be long; a log line or transcript wants the gist. */
const ERROR_BODY_CHARS = 500;

/**
 * An upstream error body is third-party data and says whatever it likes,
 * including echoing our own request headers back at us. Anything from that body
 * is scrubbed before it can reach a log line or an error message.
 */
function redact(text: string, secret: string): string {
  return text.split(secret).join("[redacted]");
}

function model(): string {
  // || not ??: an empty GROQ_MODEL= line in .env must fall back, not blank out.
  return process.env.GROQ_MODEL || DEFAULT_MODEL;
}

/**
 * One independent read. No conversation state, no history — the caller passes
 * the whole context in, so two calls to this function cannot influence each other.
 *
 * The key is read here, at call time, and goes nowhere but the Authorization
 * header. Every throw below is built from the status and Groq's own response
 * body; none of them can carry the key, and none of them should ever be given a
 * reason to.
 */
export async function chat(args: { systemPrompt: string; userMessage: string }): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model(),
        messages: [
          { role: "system", content: args.systemPrompt },
          { role: "user", content: args.userMessage },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    // One hung request must not hold the other three personas hostage.
    // Matched by name, not instanceof: AbortSignal.timeout rejects with a
    // DOMException, which is not reliably an Error subclass across runtimes.
    if ((err as { name?: unknown } | null)?.name === "TimeoutError") {
      throw new Error(`Groq request timed out after ${TIMEOUT_MS}ms`, { cause: err });
    }
    throw new Error("Groq request failed: network error", { cause: err });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Groq request failed (${res.status}): ${redact(body, key).slice(0, ERROR_BODY_CHARS)}`,
    );
  }

  const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("Groq response had no message content");
  }
  return content;
}
