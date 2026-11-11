import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { LANDING_PAGES, landingPage } from "./landing-pages.ts";

const SEED_MEDIA = path.join(import.meta.dirname, "../../seed/media");

describe(landingPage, () => {
  it("finds each campaign page by its slug", () => {
    expect(Object.keys(LANDING_PAGES)).toStrictEqual([
      "debt-consolidation",
      "digital-heloc",
      "home-renovation",
      "keep-your-rate",
    ]);
    expect(landingPage("debt-consolidation")?.title).toBe(
      "Consolidate Debt With a HELOC"
    );
  });

  it("finds nothing for other slugs, including inherited object keys", () => {
    expect(landingPage("toString")).toBeUndefined();
    expect(landingPage()).toBeUndefined();
    expect(landingPage("heloc")).toBeUndefined();
    expect(landingPage("digital-heloc")?.title).toBe(
      "A Digital HELOC With Less Paperwork"
    );
  });

  it("shows each hero photo from the seed media every stage serves, with its placeholder", () => {
    const [hero] = LANDING_PAGES["keep-your-rate"].content;
    expect(hero).toMatchObject({
      _type: "page_hero",
      image: {
        alt: "A two-story craftsman home lit up at dusk",
        blurhash: "LaA,;8WBJBbcPEs:oeWXFif*xCs.",
        dominantColor: "rgb(75,83,88)",
        filename: "estate-hero-X6IKSjTQ.jpg",
        id: "estate-hero-X6IKSjTQ.jpg",
        src: "/_seed/media/estate-hero-X6IKSjTQ.jpg",
      },
    });
    const photos = Object.values(LANDING_PAGES).flatMap(({ content }) =>
      content.flatMap((block) =>
        block._type === "page_hero" && block.image?.filename !== undefined
          ? [block.image.filename]
          : []
      )
    );
    expect(photos).toHaveLength(4);
    expect(
      photos.filter((file) => !existsSync(path.join(SEED_MEDIA, file)))
    ).toStrictEqual([]);
  });
});
