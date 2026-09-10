import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import type { Issue } from "../shared/types";

const ISSUES_FILE = "issues.json";
const EVENTS_FILE = "events.jsonl";

export interface IssueStore {
  getAll(): Issue[];
  getUnresolvedCount(): number;
  create(input: { title: string; severity: Issue["severity"]; ownerAgentId?: string | null }): Issue;
  resolve(id: string): Issue | undefined;
  events: EventEmitter;
}

export function createIssueStore(dataDir: string): IssueStore {
  fs.mkdirSync(dataDir, { recursive: true });
  const issuesFile = path.join(dataDir, ISSUES_FILE);
  const eventsFile = path.join(dataDir, EVENTS_FILE);
  const issues = new Map<string, Issue>();
  const events = new EventEmitter();

  function persist(): void {
    fs.writeFileSync(issuesFile, JSON.stringify([...issues.values()], null, 2));
  }
  function appendLog(entry: object): void {
    fs.appendFileSync(eventsFile, JSON.stringify(entry) + "\n");
  }

  if (fs.existsSync(issuesFile)) {
    for (const issue of JSON.parse(fs.readFileSync(issuesFile, "utf8")) as Issue[]) {
      issues.set(issue.id, issue);
    }
  }

  return {
    getAll: () => [...issues.values()],
    getUnresolvedCount: () => [...issues.values()].filter((i) => !i.resolved).length,
    create(input) {
      const issue: Issue = {
        id: randomUUID(),
        title: input.title,
        severity: input.severity,
        createdAt: new Date().toISOString(),
        resolved: false,
        ownerAgentId: input.ownerAgentId ?? null,
      };
      issues.set(issue.id, issue);
      persist();
      appendLog({ type: "created", issue });
      events.emit("created", issue);
      return issue;
    },
    resolve(id) {
      const issue = issues.get(id);
      if (!issue) return undefined;
      issue.resolved = true;
      persist();
      appendLog({ type: "resolved", issue });
      events.emit("resolved", issue);
      return issue;
    },
    events,
  };
}
