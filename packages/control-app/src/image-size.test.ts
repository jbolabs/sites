import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { imageSize } from "./image-size.ts";

// Encoded by sharp; sizes confirmed with macOS `sips -g pixelWidth -g pixelHeight`.
const fixture = (name: string): Uint8Array =>
  readFileSync(path.join(import.meta.dirname, "fixtures", name));

describe(imageSize, () => {
  it.each([
    ["64x48.png", { format: "png", height: 48, width: 64 }],
    ["120x63-progressive.jpg", { format: "jpeg", height: 63, width: 120 }],
    ["90x47-lossy.webp", { format: "webp", height: 47, width: 90 }],
    ["33x17-lossless.webp", { format: "webp", height: 17, width: 33 }],
    ["40x21-alpha.webp", { format: "webp", height: 21, width: 40 }],
    ["25x14.gif", { format: "gif", height: 14, width: 25 }],
  ])("reads %s", (name, expected) => {
    expect(imageSize(fixture(name))).toStrictEqual(expected);
  });

  it("rejects bytes that are not an image", () => {
    const html = new TextEncoder().encode(
      "<!doctype html><html><head><title>Not found</title></head></html>"
    );
    expect(imageSize(html)).toBeUndefined();
    expect(imageSize(fixture("64x48.png"))?.format).toBe("png");
  });
});
