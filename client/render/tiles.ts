import Phaser from "phaser";
import { Config } from "../../shared/config";

/** Swap this texture for a loaded tileset PNG later; nothing else changes. */
const FLOOR_TEXTURE = "floor-tile";

export function createFloor(scene: Phaser.Scene): void {
  const size = Config.tileSize;

  if (!scene.textures.exists(FLOOR_TEXTURE)) {
    const g = scene.make.graphics();
    g.fillStyle(0x1c2740, 1);
    g.fillRect(0, 0, size, size);
    g.fillStyle(0x2a3752, 1);
    g.fillRect(2, 2, size - 4, size - 4);
    g.generateTexture(FLOOR_TEXTURE, size, size);
    g.destroy();
  }

  for (let y = 0; y < Config.canvasHeight; y += size) {
    for (let x = 0; x < Config.canvasWidth; x += size) {
      scene.add.image(x, y, FLOOR_TEXTURE).setOrigin(0, 0);
    }
  }
}
