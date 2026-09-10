import Phaser from "phaser";
import type { Agent, WSEvent } from "../../shared/types";
import { connectSocket, type GameSocket, type SocketState } from "../net/socket";

export class WorldScene extends Phaser.Scene {
  private readonly agents = new Map<string, Agent>();
  private socket?: GameSocket;
  private statusText?: Phaser.GameObjects.Text;

  constructor() {
    super("WorldScene");
  }

  create(): void {
    console.log("WorldScene created");

    this.statusText = this.add.text(12, 12, "Disconnected", {
      fontFamily: "monospace",
      fontSize: "18px",
      color: "#ff5555",
    });

    this.socket = connectSocket({
      onEvent: (event) => this.handleEvent(event),
      onState: (state) => this.setStatus(state),
    });
  }

  private setStatus(state: SocketState): void {
    const connected = state === "connected";
    this.statusText?.setText(connected ? "Connected" : "Disconnected");
    this.statusText?.setColor(connected ? "#55ff88" : "#ff5555");
  }

  private handleEvent(event: WSEvent): void {
    switch (event.type) {
      case "agent:list":
        this.agents.clear();
        for (const agent of event.payload) this.agents.set(agent.id, agent);
        console.log(`[ws] agent:list (${event.payload.length} agents)`);
        break;
      case "agent:update": {
        const agent = event.payload;
        this.agents.set(agent.id, agent);
        console.log(
          `[ws] agent:update ${agent.id} ${agent.status} (${agent.position.x},${agent.position.y})`,
        );
        break;
      }
      default:
        console.log("[ws]", event);
    }
  }
}
