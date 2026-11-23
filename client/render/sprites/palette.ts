/**
 * The one palette every sprite in this folder draws from.
 *
 * Keys are hex digits, not names, because Phaser's `Phaser.Types.Create.Palette`
 * is a closed type requiring exactly "0"-"9" and "A"-"F" (phaser.d.ts). A
 * mnemonic-keyed object would not typecheck. The 16-key shape is also the
 * project's colour cap, so the alphabet below is the whole vocabulary:
 *
 *   sprite data characters: 0-9 A-F, plus '.' or ' ' for transparent
 *
 * '.' and ' ' are handled by GenerateTexture itself and never reach the palette,
 * so they cost nothing — the 16 slots below are all colour.
 *
 * The six station accents (A-F) are exactly server-side identity: the same
 * values as STATION_COLORS in ../stations.ts, so an agent body and its landmark
 * are recognisably the same place, and MEETING_COLOR for the plaza.
 *
 * NOTE (stage 2): all 16 slots are committed, and each textures.generate call
 * takes its own palette object. Agent characters therefore need their own
 * palette (e.g. sprites/character-palette.ts) rather than reusing this one.
 *
 * This module is deliberately Phaser-free — no import, and no
 * `Phaser.Types.Create.Palette` annotation. It is imported by the sprite-data
 * test and by the scratch preview script, both of which run under plain Node
 * with no Phaser present. That type is structurally identical to what is below
 * (16 required string keys); the single cast to it lives in ../art.ts, at the
 * one place that actually calls into Phaser.
 */
export const PALETTE: Readonly<Record<string, string>> = {
  "0": "#101828", // outline / darkest — same value as STROKE_COLOR in ../stations.ts
  "1": "#2E6B3A", // grass dark
  "2": "#3E8948", // grass mid — the floor base tone
  "3": "#63C74D", // grass light
  "4": "#FFFFFF", // white / highlight / glass
  "5": "#6B7280", // stone mid
  "6": "#3F4552", // stone dark / metal shadow
  "7": "#8A5A34", // wood mid
  "8": "#5A3A22", // wood dark
  "9": "#7A5230", // dirt / earth
  A: "#4F8EF7", // lab blue
  B: "#F78F4F", // forge orange
  C: "#5FD07A", // garden green
  D: "#B06FF5", // library purple
  E: "#F5D24F", // commons yellow
  F: "#F75F8F", // meeting pink
};

/** Human-readable slot meanings, for the preview legend. Not used at runtime. */
export const PALETTE_ROLES: Readonly<Record<string, string>> = {
  "0": "outline",
  "1": "grass dark",
  "2": "grass mid",
  "3": "grass light",
  "4": "white / glass",
  "5": "stone mid",
  "6": "stone dark",
  "7": "wood mid",
  "8": "wood dark",
  "9": "dirt",
  A: "lab",
  B: "forge",
  C: "garden",
  D: "library",
  E: "commons",
  F: "meeting",
};

export const TRANSPARENT_CHARS = new Set([".", " "]);

/** Every character a sprite row may contain. */
export const PALETTE_ALPHABET: ReadonlySet<string> = new Set([
  ...Object.keys(PALETTE),
  ...TRANSPARENT_CHARS,
]);

/**
 * Why this exists: GenerateTexture writes `ctx.fillStyle = palette[d]`. For an
 * unknown character that assignment is `undefined`, which the canvas spec ignores
 * — so the pixel is painted in whatever colour came before it, silently. A typo
 * would show up as a stray coloured pixel with no error anywhere. Callers
 * validate with this before generating.
 */
export function paletteCharError(char: string): string | undefined {
  return PALETTE_ALPHABET.has(char) ? undefined : `unknown palette character ${JSON.stringify(char)}`;
}
