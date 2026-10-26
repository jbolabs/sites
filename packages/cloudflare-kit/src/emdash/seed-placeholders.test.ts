import { describe, expect, it } from "vitest";

import { withSeedPlaceholder } from "./seed-placeholders.ts";

const placeholders = {
  "ranch-exterior.jpg": {
    blurhash: "LlF$;9%ftRtQ?dx]tRogxvx]bIog",
    bytes: 834_825,
    dominantColor: "rgb(109,119,98)",
  },
};

describe(withSeedPlaceholder, () => {
  it("adds the placeholder of the seed photo an image came from", () => {
    expect(
      withSeedPlaceholder(
        { alt: "Ranch", filename: "ranch-exterior.jpg", id: "01H" },
        placeholders
      )
    ).toStrictEqual({
      alt: "Ranch",
      blurhash: "LlF$;9%ftRtQ?dx]tRogxvx]bIog",
      dominantColor: "rgb(109,119,98)",
      filename: "ranch-exterior.jpg",
      id: "01H",
    });
  });

  it("keeps the placeholder EmDash made for a CMS upload", () => {
    const upload = {
      blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH",
      dominantColor: "rgb(10,20,30)",
      filename: "ranch-exterior.jpg",
      id: "01J",
    };
    expect(withSeedPlaceholder(upload, placeholders)).toStrictEqual(upload);
  });

  it("leaves other images, URLs and empty fields alone", () => {
    const other = { filename: "kitchen.jpg", id: "01K" };
    expect(withSeedPlaceholder(other, placeholders)).toStrictEqual({
      filename: "kitchen.jpg",
      id: "01K",
    });
    expect(withSeedPlaceholder("/photo.jpg", placeholders)).toBe("/photo.jpg");
    expect(withSeedPlaceholder(null, placeholders)).toBeNull();
  });
});
