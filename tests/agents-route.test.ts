import { afterAll, describe, expect, it } from "vitest";
import type { Server } from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { createAgentStore } from "../server/agent-store";
import { createAgentsRouter } from "../server/routes/agents";

const dirs: string[] = [];
const servers: Server[] = [];
afterAll(() => {
  dirs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
  servers.forEach((server) => server.close());
});

function startApp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentrift-agents-route-"));
  dirs.push(dir);
  const app = express();
  app.use(express.json());
  app.use("/api/agents", createAgentsRouter(createAgentStore(dir)));
  const server = app.listen(0);
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  return `http://localhost:${address.port}`;
}

function put(base: string, body: object): Promise<Response> {
  return fetch(`${base}/api/agents/ada`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("agents routes", () => {
  it("accepts a target without any route change", async () => {
    const base = startApp();
    const res = await put(base, { target: { x: 100, y: 200 } });
    expect(res.status).toBe(200);
    expect((await res.json()).target).toEqual({ x: 100, y: 200 });
  });

  it("clears a target with null", async () => {
    const base = startApp();
    const res = await put(base, { target: null });
    expect(res.status).toBe(200);
    expect((await res.json()).target).toBeNull();
  });

  it("rejects a target missing y", async () => {
    const base = startApp();
    expect((await put(base, { target: { x: 100 } })).status).toBe(400);
  });

  it("rejects a non-finite coordinate over the wire (1e999 parses to Infinity)", async () => {
    const base = startApp();
    expect((await put(base, { position: { x: 1e999, y: 200 } })).status).toBe(400);
  });

  it("rejects an unknown field", async () => {
    const base = startApp();
    expect((await put(base, { flying: true })).status).toBe(400);
  });
});
