import { describe, expect, it } from "vitest";

import { lockStep } from "./migrate.ts";

const now = Date.parse("2026-10-30T21:20:00.000Z");

describe(lockStep, () => {
  it("applies when no lock is held", () => {
    expect(lockStep(undefined, now)).toStrictEqual({ kind: "apply" });
  });

  it("waits for a lock a live request may still hold", () => {
    expect(
      lockStep(
        { heldSince: "2026-10-30T21:10:00.000Z", id: "1793394600000" },
        now
      )
    ).toStrictEqual({ kind: "wait" });
  });

  it("releases a lock older than any Worker invocation", () => {
    expect(
      lockStep(
        { heldSince: "2026-10-30T20:44:42.586Z", id: "1793393082586" },
        now
      )
    ).toStrictEqual({ id: "1793393082586", kind: "release" });
  });
});
