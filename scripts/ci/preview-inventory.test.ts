import { describe, expect, it } from "vitest";

import { mergePreviewStacks, previewStacks } from "./preview-inventory.ts";

const oldRevision = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const newRevision = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

describe(mergePreviewStacks, () => {
  it("retains earlier sites absent from a later deploy and pins the latest attempted stack", () => {
    expect(
      mergePreviewStacks(
        [
          { revision: oldRevision, site: "ani-wenger" },
          { revision: oldRevision, site: "access-electric" },
        ],
        [{ revision: newRevision, site: "access-electric" }]
      )
    ).toStrictEqual([
      {
        revision: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        site: "access-electric",
      },
      {
        revision: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        site: "ani-wenger",
      },
    ]);
  });
});

describe(previewStacks, () => {
  it("decodes only the intended stage's validated inventory", () => {
    expect(
      previewStacks(
        '<!-- preview-stack-inventory\n{"stage":"pr-55","stacks":[{"site":"ani-wenger","revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]}\n-->',
        "pr-55"
      )
    ).toStrictEqual([
      {
        revision: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        site: "ani-wenger",
      },
    ]);
    expect(() =>
      previewStacks(
        '<!-- preview-stack-inventory\n{"stage":"prod","stacks":[]}\n-->',
        "pr-55"
      )
    ).toThrow("Preview inventory stage mismatch");
    expect(() =>
      previewStacks(
        '<!-- preview-stack-inventory\n{"stage":"pr-55","stacks":[{"site":"../other","revision":"main"}]}\n-->',
        "pr-55"
      )
    ).toThrow(/Expected/u);
  });
});
