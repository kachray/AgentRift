import { afterAll, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import type { WSEvent } from "../shared/types";
import { createIssueStore } from "../server/issue-store";
import { createIssuesRouter } from "../server/routes/issues";

const dirs: string[] = [];
const servers: Server[] = [];
afterAll(() => {
  dirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
  servers.forEach((server) => server.close());
});

function startApp(): { base: string; broadcast: ReturnType<typeof vi.fn> } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentrift-routes-"));
  dirs.push(dir);
  const store = createIssueStore(dir);
  const broadcast = vi.fn((event: WSEvent) => {});
  const app = express();
  app.use(express.json());
  app.use("/api/issues", createIssuesRouter(store, broadcast));
  const server = app.listen(0);
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return { base: `http://localhost:${address.port}`, broadcast };
}

describe("issues routes", () => {
  it("triggers council exactly once when unresolved count reaches threshold", async () => {
    const { base, broadcast } = startApp();
    const post = (body: object) =>
      fetch(`${base}/api/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    expect((await post({ title: "Reactor overheating", severity: "high" })).status).toBe(201);
    expect((await post({ title: "Pump leak", severity: "low" })).status).toBe(201);
    expect(broadcast).not.toHaveBeenCalled();
    expect((await post({ title: "Fuel shortage", severity: "medium" })).status).toBe(201);
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(broadcast.mock.calls[0][0]).toEqual({
      type: "council:triggered",
      payload: { unresolvedCount: 3, threshold: 3 },
    });
  });

  it("rejects issue with missing severity", async () => {
    const { base } = startApp();
    const res = await fetch(`${base}/api/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "No severity" }),
    });
    expect(res.status).toBe(400);
  });
});
