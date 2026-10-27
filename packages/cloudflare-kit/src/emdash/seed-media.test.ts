import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  placeholdersByMediaFilename,
  resolveSeedMedia,
  syncSeedPlaceholders,
} from "./seed-media.ts";

describe(resolveSeedMedia, () => {
  it("makes seed media URLs absolute and leaves other URLs alone", () => {
    const seed = JSON.stringify({
      a: { $media: { url: "/_seed/media/logo.png" } },
      b: { $media: { url: "https://cdn.example.com/x.jpg" } },
      link: "/contact",
    });
    const Media = Schema.Struct({
      $media: Schema.Struct({ url: Schema.String }),
    });
    const resolved = Schema.decodeUnknownSync(
      Schema.fromJsonString(
        Schema.Struct({ a: Media, b: Media, link: Schema.String })
      )
    )(resolveSeedMedia(seed, "https://example.com/_seed/media/"));
    expect(resolved.a.$media.url).toBe(
      "https://example.com/_seed/media/logo.png"
    );
    expect(resolved.b.$media.url).toBe("https://cdn.example.com/x.jpg");
    expect(resolved.link).toBe("/contact");
  });
});

/** A 4x4 solid red PNG. */
const RED_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGP4z8AARwzEcQCukw/x0F8jngAAAABJRU5ErkJggg=="
  ),
  (char) => char.codePointAt(0) ?? 0
);

const mediaDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "seed-media-"));
  writeFileSync(path.join(dir, "red.png"), RED_PNG);
  writeFileSync(path.join(dir, "notes.txt"), "not a photo");
  return dir;
};

describe(syncSeedPlaceholders, () => {
  it("computes a placeholder for each photo and skips other files", async () => {
    const placeholders = await syncSeedPlaceholders(mediaDir(), {});
    expect(Object.keys(placeholders)).toStrictEqual(["red.png"]);
    expect(placeholders["red.png"]).toMatchObject({
      bytes: 73,
      dominantColor: "rgb(255,0,0)",
    });
  });

  it("reuses a known placeholder while the photo keeps its size", async () => {
    const known = { blurhash: "known", bytes: 73, dominantColor: "rgb(1,2,3)" };
    const placeholders = await syncSeedPlaceholders(mediaDir(), {
      "gone.jpg": known,
      "red.png": known,
    });
    expect(placeholders).toStrictEqual({ "red.png": known });
  });

  it("redoes a placeholder when the photo was replaced", async () => {
    const placeholders = await syncSeedPlaceholders(mediaDir(), {
      "red.png": { blurhash: "old", bytes: 12, dominantColor: "rgb(1,2,3)" },
    });
    expect(placeholders["red.png"]?.dominantColor).toBe("rgb(255,0,0)");
  });
});

describe(placeholdersByMediaFilename, () => {
  const photo = {
    blurhash: "LaA,;8WBJBbcPEs:oeWXFif*xCs.",
    bytes: 301_182,
    dominantColor: "rgb(75,83,88)",
  };

  it("keys each seed photo's placeholder by the filename its media value keeps", () => {
    const seed = JSON.stringify({
      content: [
        {
          image: {
            $media: {
              filename: "home-hero.jpg",
              url: "/_seed/media/estate-hero-X6IKSjTQ.jpg",
            },
          },
        },
        { image: { $media: { url: "/_seed/media/estate-hero-X6IKSjTQ.jpg" } } },
        { image: { $media: { url: "/_seed/media/missing.jpg" } } },
        { image: { $media: { url: "https://cdn.example.com/x.jpg" } } },
      ],
    });
    expect(
      placeholdersByMediaFilename(seed, { "estate-hero-X6IKSjTQ.jpg": photo })
    ).toStrictEqual({
      "estate-hero-X6IKSjTQ.jpg": photo,
      "home-hero.jpg": photo,
    });
  });
});
