import type { Agent, DebateMessage, Issue } from "../../shared/types";
import { PERSONAS } from "./personas";
import { chat } from "./groq-client";

export const UNABLE_TO_RESPOND = "(unable to respond)";

/**
 * One context string, handed whole to every persona. Nothing is chained: each
 * persona reads this in isolation and never sees another's answer, which is what
 * makes the four responses four independent reads rather than one conversation.
 */
export function buildContext(issues: Issue[], agents: Agent[]): string {
  const unresolved = issues.filter((issue) => !issue.resolved);
  const issueLines = unresolved.length
    ? unresolved.map((issue) => `- ${issue.title} [${issue.severity}]`).join("\n")
    : "- (none outstanding)";
  const agentLines = agents.map((agent) => `- ${agent.name} (${agent.status})`).join("\n");

  return [
    `Unresolved issues (${unresolved.length}):`,
    issueLines,
    "",
    "Agents in the field:",
    agentLines,
    "",
    "Give the council your read on what should happen about these issues.",
  ].join("\n");
}

/**
 * Never rejects and always returns one entry per persona, in PERSONAS order.
 * allSettled, not all: a persona that 401s or times out costs its own entry and
 * nothing else.
 */
export async function runDebate(issues: Issue[], agents: Agent[]): Promise<DebateMessage[]> {
  const userMessage = buildContext(issues, agents);
  const results = await Promise.allSettled(
    PERSONAS.map((persona) => chat({ systemPrompt: persona.systemPrompt, userMessage })),
  );
  results.forEach((result, i) => {
    // Without this a retired model id turns into four silent "(unable to
    // respond)" entries and no way to tell why. Error messages from the client
    // are built from the status and Groq's body, never the key.
    if (result.status === "rejected") {
      console.error(`persona ${PERSONAS[i].name} failed:`, result.reason);
    }
  });
  return results.map((result, i) => ({
    persona: PERSONAS[i].name,
    message: result.status === "fulfilled" ? result.value : UNABLE_TO_RESPOND,
  }));
}
