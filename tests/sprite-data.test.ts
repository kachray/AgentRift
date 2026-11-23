import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FLOOR_TEXTURE_KEYS, SPRITES, MEETING_TEXTURE_KEY } from "../client/render/sprites";
import { PALETTE, PALETTE_ALPHABET } from "../client/render/sprites/palette";

/**
 * Pure data checks over the hand-authored sprites — no Phaser, no scene.
 *
 * These exist because GenerateTexture fails silently on malformed data:
 *
 *   - The texture WIDTH comes from data[0].length while each row is drawn up to
 *     its own length, so a row with a typo'd width renders short and lopsided
 *     rather than erroring.
 *   - An unknown character makes `ctx.fillStyle = undefined`, which canvas
 *     ignores, so the pixel is painted in whatever colour came before it.
 *
 * Both produce art that looks *almost* right. Catching them here is the point.
 */
const entries = Object.entries(SPRITES);

describe("sprite data", () => {
  it("registers every sprite the game draws", () => {
    // 4 floor variants + 5 station landmarks + the meeting plaza.
    expect(entries).toHaveLength(4 + 5 + 1);
    expect(FLOOR_TEXTURE_KEYS).toHaveLength(4);
    expect(SPRITES[MEETING_TEXTURE_KEY]).toBeDefined();
    for (const key of FLOOR_TEXTURE_KEYS) expect(SPRITES[key], key).toBeDefined();
  });

  it("uses exactly the 16 palette slots", () => {
    expect(Object.keys(PALETTE)).toHaveLength(16);
  });

  it("spends every palette slot on a character that is legal in sprite data", () => {
    for (const slot of Object.keys(PALETTE)) {
      expect(PALETTE_ALPHABET.has(slot), `slot ${slot}`).toBe(true);
    }
  });

  it("declares every sprite with rows of the declared width, and equal to each other", () => {
    for (const [key, sprite] of entries) {
      expect(sprite.data.length, `${key} row count`).toBe(sprite.height);
      sprite.data.forEach((row, y) => {
        expect(row.length, `${key} row ${y} width`).toBe(sprite.width);
      });
    }
  });

  it("only uses palette characters, plus the transparent markers", () => {
    for (const [key, sprite] of entries) {
      sprite.data.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          expect(
            PALETTE_ALPHABET.has(ch),
            `${key} row ${y} col ${x}: ${JSON.stringify(ch)} is not in the palette alphabet`,
          ).toBe(true);
        }
      });
    }
  });

  it("keeps the landmark object out of the rows the agent circle covers", () => {
    // Landmark anchor is (0.5, 0.9) on a 24px sprite at scale 3: the agent's
    // 28px circle covers art rows 17-23, so those rows must stay transparent
    // apart from a narrow footprint. Regression guard for the amendment-1 rule.
    const footprintCols = (row: string) =>
      [...row].flatMap((ch, x) => (ch === "." ? [] : [x])).filter((x) => x >= 0);

    for (const id of ["lab", "forge", "garden", "library", "commons"]) {
      const sprite = SPRITES[`station-${id}`];
      expect(sprite, id).toBeDefined();
      for (let y = 17; y < sprite.height; y++) {
        const cols = footprintCols(sprite.data[y]);
        // Only a narrow footprint may survive down here, and it must not span
        // across the whole sprite.
        expect(cols.length, `${id} row ${y} has art across ${cols.length} columns`).toBeLessThan(12);
      }
    }
  });
});

// ---------------------------------------------------------------- source guard
//
// The rows must stay plain literals. That is not fussiness: a slice() or a
// concatenation in a row produces a string of the *right* length in the common
// case, so the width test above passes while the art is quietly shifted by a
// pixel. The data test cannot see that — only the source can. These tests read
// each sprite module as text and refuse the whole class of edit.

/** Row count each literal source must contain. */
const LITERAL_SOURCES: Readonly<Record<string, number>> = {
  floor: 4 * 16, // four 16-row variants
  lab: 24,
  forge: 24,
  garden: 24,
  library: 24,
  commons: 24,
};

/** A row literal: one double-quoted string, optionally comma-terminated. */
const ROW_LITERAL = /^"([^"]*)"\s*,?$/;

const BANNED = [".slice(", ".substring(", ".substr(", ".concat(", ".padEnd(", ".padStart("] as const;

function readSpriteSource(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`../client/render/sprites/${name}.ts`, import.meta.url)),
    "utf8",
  );
}

/** Headers describe row anatomy in prose, so they must not trip the checks. */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("sprite source", () => {
  for (const [name, expectedRows] of Object.entries(LITERAL_SOURCES)) {
    describe(`${name}.ts`, () => {
      const stripped = withoutComments(readSpriteSource(name));
      const lines = stripped
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      it("contains no string surgery", () => {
        for (const banned of BANNED) {
          expect(stripped.includes(banned), `${name}.ts contains ${banned}`).toBe(false);
        }
        // No concatenation either: a row is one literal, not pieces joined.
        expect(stripped.includes("+"), `${name}.ts contains a + operator`).toBe(false);
      });

      it("expresses every row as a plain quoted literal", () => {
        const quoted = lines.filter((line) => line.includes('"') && !/^(import|export)\b/.test(line));
        expect(quoted, `${name}.ts row literal count`).toHaveLength(expectedRows);
        for (const line of quoted) {
          expect(ROW_LITERAL.test(line), `not a plain row literal: ${line}`).toBe(true);
        }
      });
    });
  }

  it("keeps the generated plaza free of string surgery too", () => {
    // meeting.ts builds its rows from geometry instead of listing them, so only
    // the surgery ban applies — a slice() there would be just as silent.
    const stripped = withoutComments(readSpriteSource("meeting"));
    for (const banned of BANNED) {
      expect(stripped.includes(banned), `meeting.ts contains ${banned}`).toBe(false);
    }
  });
});
