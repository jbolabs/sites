import { describe, expect, it } from "vitest";

import { photoProps } from "./photo.ts";

const placeholders = {
  "great-room.jpg": {
    blurhash: "LSJa$Ir?%Mad~pWAWUM|Mvs:Rjxu",
    bytes: 644_518,
    dominantColor: "rgb(159,151,134)",
  },
};

describe(photoProps, () => {
  it("fills in a seeded photo's placeholder and widths", () => {
    expect(
      photoProps(
        { filename: "great-room.jpg", id: "01H", width: 1600 },
        placeholders
      )
    ).toStrictEqual({
      image: {
        blurhash: "LSJa$Ir?%Mad~pWAWUM|Mvs:Rjxu",
        dominantColor: "rgb(159,151,134)",
        filename: "great-room.jpg",
        id: "01H",
        width: 1600,
      },
      widths: [640, 750, 828, 1080, 1280, 1600],
    });
  });

  it("leaves widths to Astro when the original's size is unknown", () => {
    const unsized = photoProps({ id: "01H" }, placeholders);
    expect(unsized.image).toStrictEqual({ id: "01H" });
    expect(unsized.widths).toBeUndefined();
    expect(photoProps("/photo.jpg", placeholders).image).toBe("/photo.jpg");
  });
});
