import Phaser from "phaser";
import { withinEpsilon } from "../../shared/config";
import type { Agent, WSEvent } from "../../shared/types";
import { connectSocket, type GameSocket, type SocketState, reportAgentArrival } from "../net/socket";
import { createFloor } from "../render/tiles";
import { createStations } from "../render/stations";
import { createAgentViews } from "../render/agents";
import { createCouncilPanel, type CouncilPanel } from "../render/council-panel";
import { findPath, type Point } from "../pathfinding/grid-path";

/** Calibration knobs, not constants of nature. */
const WALK_SPEED = 160; // px per second
const WALK_MIN_MS = 80; // floor, so a 2px nudge is not an instant teleport

interface Walk {
  target: Point;
  tween: Phaser.Tweens.TweenChain;
}

export class WorldScene extends Phaser.Scene {
  private readonly agents = new Map<string, Agent>();
  private views = new Map<string, Phaser.GameObjects.Container>();
  private readonly walks = new Map<string, Walk>();
  private socket?: GameSocket;
  private statusText?: Phaser.GameObjects.Text;
  private council?: CouncilPanel;

  constructor() {
    super("WorldScene");
  }

  create(): void {
    createFloor(this);
    createStations(this);
    this.council = createCouncilPanel(this);

    this.statusText = this.add.text(12, 12, "Disconnected", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#ff5555",
    });

    this.socket = connectSocket({
      onEvent: (event) => this.handleEvent(event),
      onState: (state) => this.setStatus(state),
    });

    // A scene restart must not leak the old socket and its retry loop.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.socket?.close();
      this.socket = undefined;
    });
  }

  private setStatus(state: SocketState): void {
    const label =
      state === "connected" ? "Connected" : state === "retrying" ? "Reconnecting…" : "Disconnected";
    const color =
      state === "connected" ? "#55ff88" : state === "retrying" ? "#ffaa55" : "#ff5555";
    this.statusText?.setText(label);
    this.statusText?.setColor(color);
  }

  private handleEvent(event: WSEvent): void {
    switch (event.type) {
      case "agent:list":
        // Reconnect fires agent:list again — the resync must not accumulate.
        for (const id of [...this.walks.keys()]) this.stopWalk(id); // stale tweens point at old views
        for (const view of this.views.values()) view.destroy(); // otherwise sprites stack
        this.agents.clear();
        for (const agent of event.payload) this.agents.set(agent.id, agent);
        this.views = createAgentViews(this, event.payload);
        break;
      case "agent:update": {
        const agent = event.payload;
        this.agents.set(agent.id, agent);
        this.walkTo(agent);
        break;
      }
      case "council:triggered":
        this.council?.showStatus("Council convening…");
        break;
      case "council:debate":
        this.council?.show(event.payload);
        break;
      default:
        console.log("[ws]", event);
    }
  }

  /** The server owns the destination; everything below owns the walk toward it. */
  private walkTo(agent: Agent): void {
    const view = this.views.get(agent.id);
    if (!view) return; // agent:list has not arrived yet

    const dest = agent.target;
    if (!dest) {
      this.stopWalk(agent.id);
      return;
    }

    // Compare against the in-flight destination, never against view.x/y: mid-walk
    // the sprite is not at its target, so a repeat of the same command would
    // otherwise restart the walk and put two tweens on one container.
    const current = this.walks.get(agent.id);
    if (current && current.target.x === dest.x && current.target.y === dest.y) return;

    this.stopWalk(agent.id);

    const target: Point = { x: dest.x, y: dest.y };
    if (withinEpsilon({ x: view.x, y: view.y }, target)) {
      reportAgentArrival(agent.id, target); // already standing there; just clear the target
      return;
    }

    const path = findPath({ x: view.x, y: view.y }, target);
    const tweens = path.slice(1).map((point, i) => {
      const from = path[i];
      const distance = Phaser.Math.Distance.Between(from.x, from.y, point.x, point.y);
      return {
        x: point.x,
        y: point.y,
        duration: Math.max(WALK_MIN_MS, (distance / WALK_SPEED) * 1000),
        ease: "Linear",
      };
    });

    const record: Walk = { target, tween: null as unknown as Phaser.Tweens.TweenChain };
    record.tween = this.tweens.chain({
      targets: view,
      tweens,
      onComplete: () => {
        // A replaced walk must not report an arrival for a destination it never
        // reached. Identity check, not Phaser's stop() semantics.
        if (this.walks.get(agent.id) !== record) return;
        this.walks.delete(agent.id);
        reportAgentArrival(agent.id, target);
      },
    });
    this.walks.set(agent.id, record);
  }

  private stopWalk(id: string): void {
    const walk = this.walks.get(id);
    if (!walk) return;
    walk.tween.stop();
    this.walks.delete(id);
  }
}
