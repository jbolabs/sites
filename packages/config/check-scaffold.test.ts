import { describe, expect, it } from "vitest";

import {
  findScaffoldViolations,
  headerMatchesSite,
  infrastructureLine,
} from "./check-scaffold.ts";

const config = `export const site = { id: "equityfast", name: "EquityFast" };`;

describe(infrastructureLine, () => {
  it("reads the infrastructure headline from the stack comment", () => {
    const file = `/**
 * MS Custom Homes infrastructure (one Alchemy stack):
 */`;
    expect(infrastructureLine(file)).toBe("MS Custom Homes infrastructure");
  });
});

describe(headerMatchesSite, () => {
  it("accepts the site name in the header", () => {
    expect(
      headerMatchesSite("EquityFast infrastructure (one stack)", {
        id: "equityfast",
        name: "EquityFast",
      })
    ).toBeTruthy();
  });

  it("rejects the reference site name", () => {
    expect(
      headerMatchesSite("MS Custom Homes infrastructure (one stack)", {
        id: "equityfast",
        name: "EquityFast",
      })
    ).toBeFalsy();
  });
});

describe(findScaffoldViolations, () => {
  it("flags a mismatched alchemy header", () => {
    const alchemy = `/**
 * MS Custom Homes infrastructure:
 */`;
    expect(
      findScaffoldViolations("apps/equityfast", config, alchemy)
    ).toStrictEqual([
      {
        line: 2,
        path: "apps/equityfast/alchemy.run.ts",
        rule: "alchemy-header",
      },
    ]);
  });
});
