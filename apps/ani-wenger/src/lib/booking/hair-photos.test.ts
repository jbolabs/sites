import { describe, expect, it } from "vitest";

import { parsePhotosText, photosText } from "./hair-photos.ts";

const NOW = "/hair-photos/0123456789abcdef0123456789abcdef.jpg";
const GOAL = "/hair-photos/fedcba9876543210fedcba9876543210.jpg";

describe(photosText, () => {
  it("writes one labelled link per line for the admin field", () => {
    expect(
      photosText(
        [
          { kind: "now", path: NOW },
          { kind: "goal", path: GOAL },
        ],
        "https://ani.example"
      )
    ).toBe(`Now: https://ani.example${NOW}\nGoal: https://ani.example${GOAL}`);
  });
});

describe(parsePhotosText, () => {
  it("reads the links back and skips lines an editor rewrote", () => {
    expect(
      parsePhotosText(
        `Now: https://ani.example${NOW}\nShe has henna, call her\nGoal: https://other.example${GOAL}`
      )
    ).toStrictEqual([
      { kind: "now", path: NOW },
      { kind: "goal", path: GOAL },
    ]);
  });
});
