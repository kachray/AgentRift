import type { Config as AppConfig } from "./types";

export const Config: AppConfig = {
  tileSize: 48,
  canvasWidth: 1280,
  canvasHeight: 720,
  issueThreshold: 3,
  stations: [
    { id: "lab", x: 240, y: 168 },
    { id: "forge", x: 792, y: 168 },
    { id: "garden", x: 168, y: 504 },
    { id: "library", x: 840, y: 504 },
    { id: "commons", x: 504, y: 336 },
  ],
  meetingPoint: { id: "meeting", x: 504, y: 624 },
};
