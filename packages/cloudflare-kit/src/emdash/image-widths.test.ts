import { describe, expect, it } from "vitest";

import { photoWidths } from "./image-widths.ts";

describe(photoWidths, () => {
  it("stops at the original's width", () => {
    expect(photoWidths(1600)).toStrictEqual([640, 750, 828, 1080, 1280, 1600]);
    expect(photoWidths(640)).toStrictEqual([640]);
    expect(photoWidths(500)).toStrictEqual([500]);
  });

  it("stops at 2560px for larger originals", () => {
    expect(photoWidths(2400)).toStrictEqual([
      640, 750, 828, 1080, 1280, 1668, 2048, 2400,
    ]);
    expect(photoWidths(6000)).toStrictEqual([
      640, 750, 828, 1080, 1280, 1668, 2048, 2560,
    ]);
  });

  it("keeps a small original at its own size", () => {
    expect(photoWidths(800)).toStrictEqual([640, 750, 800]);
    expect(photoWidths(799.6)).toStrictEqual([640, 750, 800]);
  });
});
