import { describe, expect, it } from "vitest";

import type { BookableService } from "./services.ts";
import { combineVisit, isVisit } from "./visit.ts";

const service = (
  slug: string,
  title: string,
  durationMinutes: number,
  extra: Partial<BookableService> = {}
): BookableService => ({
  addOn: false,
  asksForPhotos: false,
  bufferMinutes: 0,
  durationMinutes,
  priceFrom: false,
  slug,
  title,
  ...extra,
});

const gloss = service("gloss", "Gloss and tone", 30, {
  addOn: true,
  price: 45,
});
const cut = service("womens-cut", "Women's precision cut", 60, { price: 120 });
const highlights = service("highlights", "Highlights", 150, {
  asksForPhotos: true,
  bufferMinutes: 15,
  price: 210,
  priceFrom: true,
});

describe(combineVisit, () => {
  it("adds up a cut with color and a gloss, main services first", () => {
    expect(combineVisit([gloss, highlights, cut])).toStrictEqual({
      asksForPhotos: true,
      bufferMinutes: 15,
      durationMinutes: 240,
      priceLabel: "$375+",
      services: [highlights, cut, gloss],
      title: "Highlights + Women's precision cut + Gloss and tone",
    });
  });

  it("counts a service chosen twice once", () => {
    expect(combineVisit([cut, cut])).toMatchObject({
      durationMinutes: 60,
      priceLabel: "$120",
    });
  });

  it("refuses add-ons on their own and an empty visit", () => {
    expect([combineVisit([gloss]), combineVisit([])]).toStrictEqual([
      { reason: "only-add-ons" },
      { reason: "empty" },
    ]);
  });

  it("leaves the price off when a service in the visit has none listed", () => {
    const visit = combineVisit([cut, service("extensions", "Extensions", 120)]);
    expect(
      isVisit(visit)
        ? [visit.durationMinutes, visit.priceLabel ?? "unlisted"]
        : visit
    ).toStrictEqual([180, "unlisted"]);
  });
});
