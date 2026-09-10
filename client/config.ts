import Phaser from "phaser";
import { Config } from "../shared/config";
import { WorldScene } from "./scenes/WorldScene";

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: Config.canvasWidth,
  height: Config.canvasHeight,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: "#1a1a2e",
  physics: {
    default: "arcade",
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [WorldScene],
};
