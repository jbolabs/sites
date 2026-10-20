import { describe, expect, it } from "vitest";

import { calendarFile, escapeText } from "./ics.ts";

describe(escapeText, () => {
  it("escapes RFC 5545 text and turns every line break into \\n", () => {
    expect(escapeText("Jane; Doe, Jr.\r\nNotes\rmore\\end\u0007")).toBe(
      String.raw`Jane\; Doe\, Jr.\nNotes\nmore\\end`
    );
  });
});

describe(calendarFile, () => {
  it("keeps a booker's line breaks from starting a property of their own", () => {
    const file = calendarFile(
      [
        {
          end: new Date("2026-10-27T17:45:00Z"),
          start: new Date("2026-10-27T17:00:00Z"),
          summary: "Jane\rDTSTART:20991231T000000Z: Men's cut",
          uid: "appt-1@aniwenger",
          updated: new Date("2026-10-20T19:00:00Z"),
        },
      ],
      "Ani Wenger appointments"
    );
    const lines = file.split("\r\n");
    expect(lines.filter((line) => line.startsWith("DTSTART"))).toStrictEqual([
      "DTSTART:20261027T170000Z",
    ]);
    expect(lines).toContain(
      String.raw`SUMMARY:Jane\nDTSTART:20991231T000000Z: Men's cut`
    );
  });
});
