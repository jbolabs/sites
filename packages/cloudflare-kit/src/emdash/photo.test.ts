import { describe, expect, it } from "vitest";

import { photoProps } from "./photo.ts";

const placeholders = {
  "great-room.jpg": {
    blurhash: "LSJa$Ir?%Mad~pWAWUM|Mvs:Rjxu",
    bytes: 644_518,
    dominantColor: "rgb(159,151,134)",
  },
};
const BLURRED =
  /^background: url\("data:image\/bmp;base64,[A-Za-z0-9+/]+=*"\) center \/ cover no-repeat rgb\(159,151,134\);$/u;

describe(photoProps, () => {
  it("fills in a seeded photo's placeholder, style and widths", () => {
    const photo = photoProps(
      { filename: "great-room.jpg", id: "01H", width: 1600 },
      placeholders
    );
    expect(photo.image).toStrictEqual({
      blurhash: "LSJa$Ir?%Mad~pWAWUM|Mvs:Rjxu",
      dominantColor: "rgb(159,151,134)",
      filename: "great-room.jpg",
      id: "01H",
      width: 1600,
    });
    expect(photo.style).toMatch(BLURRED);
    expect(photo.widths).toStrictEqual([640, 750, 828, 1080, 1280, 1600]);
  });

  it("writes a valid placeholder for a CMS upload's own blurhash, with its focal point", () => {
    const photo = photoProps(
      {
        blurhash: "LSJa$Ir?%Mad~pWAWUM|Mvs:Rjxu",
        dominantColor: "rgb(159,151,134)",
        focalX: 0.25,
        focalY: 0.33333,
        id: "01J",
      },
      placeholders
    );
    const [background, focal] = (photo.style ?? "").split("; ");
    expect(`${background};`).toMatch(BLURRED);
    expect(focal).toBe("object-position: 25% 33.33%;");
  });

  it("keeps only the focal point when the placeholder is turned off", () => {
    expect(
      photoProps(
        { filename: "great-room.jpg", focalX: 0.5, focalY: 0, id: "01H" },
        placeholders,
        { placeholder: false }
      ).style
    ).toBe("object-position: 50% 0%;");
  });

  it("reads a placeholder older values keep in meta", () => {
    expect(
      photoProps(
        { id: "01L", meta: { dominantColor: "#112233", storageKey: "a.jpg" } },
        placeholders
      ).style
    ).toBe("background: #112233;");
  });

  it("uses the dominant color alone when there is no blurhash", () => {
    expect(
      photoProps({ dominantColor: "#334455", id: "01K" }, placeholders).style
    ).toBe("background: #334455;");
  });

  it("leaves widths and style to EmDash when nothing is known", () => {
    const unknown = photoProps({ id: "01H" }, placeholders);
    expect(unknown.image).toStrictEqual({ id: "01H" });
    expect(unknown.widths).toBeUndefined();
    expect(unknown.style).toBeUndefined();
    expect(photoProps("/photo.jpg", placeholders).image).toBe("/photo.jpg");
  });
});
