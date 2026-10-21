import { describe, expect, it } from "vitest";

import { cleanupSites, stackSites } from "./preview-cleanup.ts";

describe(cleanupSites, () => {
  it("includes PR-only sites and retains main-only stacks for deletion", () => {
    expect(
      cleanupSites(
        ["apps/access-electric/alchemy.run.ts", "apps/retired/alchemy.run.ts"],
        [
          "apps/access-electric/alchemy.run.ts",
          "apps/ani-wenger/alchemy.run.ts",
        ]
      )
    ).toStrictEqual({
      head: ["access-electric", "ani-wenger"],
      historical: [],
      main: ["retired"],
    });
  });

  it("recovers an earlier deployed PR-only site removed from both final trees", () => {
    expect(
      cleanupSites(
        ["apps/access-electric/alchemy.run.ts"],
        ["apps/access-electric/alchemy.run.ts"],
        [
          {
            revision: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            site: "ani-wenger",
          },
          {
            revision: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            site: "access-electric",
          },
        ]
      )
    ).toStrictEqual({
      head: ["access-electric"],
      historical: [
        {
          revision: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          site: "ani-wenger",
        },
      ],
      main: [],
    });
  });

  it("discovers only safe, top-level site stacks, sorted and deduplicated", () => {
    expect(
      stackSites([
        "apps/ani-wenger/alchemy.run.ts",
        "apps/access-electric/alchemy.run.ts",
        "apps/ani-wenger/alchemy.run.ts",
        "apps/no-stack/package.json",
        "apps/access-electric/nested/alchemy.run.ts",
        "stacks/alchemy.run.ts",
        "apps/../alchemy.run.ts",
      ])
    ).toStrictEqual(["access-electric", "ani-wenger"]);
  });
});
