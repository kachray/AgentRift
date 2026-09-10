import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createIssueStore } from "../server/issue-store";

const dirs: string[] = [];
function tmp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentrift-issues-"));
  dirs.push(dir);
  return dir;
}
afterAll(() => dirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

describe("issue-store", () => {
  it("create counts unresolved and appends one line to events.jsonl", () => {
    const dir = tmp();
    const store = createIssueStore(dir);
    const issue = store.create({ title: "Reactor overheating", severity: "high" });
    expect(issue.resolved).toBe(false);
    expect(issue.createdAt).toBeTruthy();
    expect(issue.ownerAgentId).toBeNull();
    expect(store.getUnresolvedCount()).toBe(1);
    const lines = fs.readFileSync(path.join(dir, "events.jsonl"), "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).type).toBe("created");
  });

  it("resolve flips flag, drops count, appends resolved line", () => {
    const dir = tmp();
    const store = createIssueStore(dir);
    const issue = store.create({ title: "Reactor overheating", severity: "high" });
    store.create({ title: "Pump leak", severity: "low" });
    expect(store.getUnresolvedCount()).toBe(2);
    const resolved = store.resolve(issue.id);
    expect(resolved?.resolved).toBe(true);
    expect(store.getUnresolvedCount()).toBe(1);
    const lines = fs.readFileSync(path.join(dir, "events.jsonl"), "utf8").trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[2]).type).toBe("resolved");
  });

  it("persists across reload", () => {
    const dir = tmp();
    const store = createIssueStore(dir);
    const issue = store.create({ title: "Reactor overheating", severity: "high" });
    const reloaded = createIssueStore(dir);
    expect(reloaded.getAll()).toHaveLength(1);
    expect(reloaded.getUnresolvedCount()).toBe(1);
    expect(reloaded.getAll()[0].id).toBe(issue.id);
  });

  it("resolve on unknown id returns undefined", () => {
    const store = createIssueStore(tmp());
    expect(store.resolve("nope")).toBeUndefined();
  });

  it("emits created and resolved events", () => {
    const store = createIssueStore(tmp());
    const created: unknown[] = [];
    const resolved: unknown[] = [];
    store.events.on("created", (issue: unknown) => created.push(issue));
    store.events.on("resolved", (issue: unknown) => resolved.push(issue));
    const issue = store.create({ title: "Reactor overheating", severity: "high" });
    store.resolve(issue.id);
    expect(created).toHaveLength(1);
    expect(resolved).toHaveLength(1);
    expect((resolved[0] as { resolved: boolean }).resolved).toBe(true);
  });
});
