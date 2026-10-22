import { describe, expect, it } from "vitest";

import { patchesStamp } from "./stamp-patches.ts";

// Expected values from Python's hashlib over the same "name\0content\0" stream.
describe(patchesStamp, () => {
  it("derives the same stamp whatever order the directory lists patches in", () => {
    expect(
      patchesStamp([
        { content: "two", name: "b.patch" },
        { content: "one", name: "a.patch" },
      ])
    ).toBe(1_257_517_414);
  });

  it("moves the stamp when a patch's content changes", () => {
    expect(
      patchesStamp([
        { content: "one", name: "a.patch" },
        { content: "two!", name: "b.patch" },
      ])
    ).toBe(1_316_633_444);
  });
});
