import express from "express";
import { WebSocketServer } from "ws";

const app = express();
app.get("/health", (_req, res) => res.json({ ok: true }));

const server = app.listen(3000, () => console.log("server on :3000"));
new WebSocketServer({ server });
