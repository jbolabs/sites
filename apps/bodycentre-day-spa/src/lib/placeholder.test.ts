import { describe, expect, it } from "vitest";

import { textParts } from "./placeholder.ts";

describe(textParts, () => {
  it("marks bracketed text as a placeholder and keeps the rest as copy", () => {
    expect(textParts("[[843]] reviews on Yelp")).toStrictEqual([
      { placeholder: true, text: "843" },
      { placeholder: false, text: " reviews on Yelp" },
    ]);
  });

  it("finds several placeholders in one line", () => {
    expect(textParts("Open [[9 am]] to [[7 pm]]")).toStrictEqual([
      { placeholder: false, text: "Open " },
      { placeholder: true, text: "9 am" },
      { placeholder: false, text: " to " },
      { placeholder: true, text: "7 pm" },
    ]);
  });

  it("leaves confirmed copy as one plain part", () => {
    expect(textParts("From $99")).toStrictEqual([
      { placeholder: false, text: "From $99" },
    ]);
  });
});
