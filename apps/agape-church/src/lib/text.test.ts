import { describe, expect, it } from "vitest";

import { lines, paragraphs, textParts } from "./text.ts";

describe(textParts, () => {
  it("turns [label](url) into a link between plain text", () => {
    expect(
      textParts(
        "Call 714.720.8342 or email [treasury@agapeoc.com](mailto:treasury@agapeoc.com)."
      )
    ).toStrictEqual([
      { text: "Call 714.720.8342 or email " },
      { href: "mailto:treasury@agapeoc.com", text: "treasury@agapeoc.com" },
      { text: "." },
    ]);
  });

  it("leaves text without links whole", () => {
    expect(textParts("Sundays at 10 AM.")).toStrictEqual([
      { text: "Sundays at 10 AM." },
    ]);
  });
});

describe("paragraphs and lines", () => {
  it("splits on blank lines for paragraphs and on newlines for lines", () => {
    const text =
      "Agape Christian Church of OC\n104 S Cross Creek Road\n\nPlease make checks payable to Agape.";
    expect(paragraphs(text)).toStrictEqual([
      "Agape Christian Church of OC\n104 S Cross Creek Road",
      "Please make checks payable to Agape.",
    ]);
    expect(lines(text)).toStrictEqual([
      "Agape Christian Church of OC",
      "104 S Cross Creek Road",
      "Please make checks payable to Agape.",
    ]);
  });
});
