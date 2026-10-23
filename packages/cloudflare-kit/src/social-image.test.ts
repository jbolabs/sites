import { describe, expect, it } from "vitest";

import { socialImage } from "./social-image.ts";

const origin = "https://example.com";
const fallback = "/og-default.png";

describe(socialImage, () => {
  it("serves a CMS photo as a 1200-wide JPEG from the image endpoint", () => {
    expect(
      socialImage({
        fallback,
        origin,
        photo: { id: "01ABC", meta: { storageKey: "01ABC.webp" } },
      })
    ).toBe(
      "https://example.com/_image?href=%2F_emdash%2Fapi%2Fmedia%2Ffile%2F01ABC.webp&w=1200&f=jpeg"
    );
  });

  it("prefers an editor's SEO image over the entry's photo", () => {
    expect(
      socialImage({
        fallback,
        image: "https://example.com/_emdash/api/media/file/hero.png",
        origin,
        photo: { id: "photo.png" },
        siteDefault: "/_emdash/api/media/file/default.png",
      })
    ).toBe(
      "https://example.com/_image?href=%2F_emdash%2Fapi%2Fmedia%2Ffile%2Fhero.png&w=1200&f=jpeg"
    );
  });

  it("uses the CMS default before the site's static card", () => {
    expect(
      socialImage({
        fallback,
        image: null,
        origin,
        siteDefault: "/_emdash/api/media/file/default.png",
      })
    ).toBe(
      "https://example.com/_image?href=%2F_emdash%2Fapi%2Fmedia%2Ffile%2Fdefault.png&w=1200&f=jpeg"
    );
  });

  it("skips an empty CMS image field, which EmDash returns as null", () => {
    expect(
      socialImage({
        fallback,
        origin,
        photo: null,
        siteDefault: "/_emdash/api/media/file/default.png",
      })
    ).toBe(
      "https://example.com/_image?href=%2F_emdash%2Fapi%2Fmedia%2Ffile%2Fdefault.png&w=1200&f=jpeg"
    );
  });

  it("falls back to the static card as an absolute URL", () => {
    expect(socialImage({ fallback, image: "", origin })).toBe(
      "https://example.com/og-default.png"
    );
  });

  it("leaves images outside the CMS untouched", () => {
    expect(socialImage({ fallback, image: "/brand/card.jpg", origin })).toBe(
      "https://example.com/brand/card.jpg"
    );
  });
});
