import { describe, expect, it } from "vitest";

import { LANDING_PAGES, SOFT_CHECK, landingPage } from "./landing-pages.ts";
import type { LandingPage } from "./landing-pages.ts";

const MARKERS = ["¹", "²", "³"];
const pageText = (page: LandingPage) =>
  [
    page.headline,
    page.headlineAccent,
    page.benefit,
    ...page.points.flatMap((point) => [point.text, point.detail ?? ""]),
  ].join(" ");

describe(landingPage, () => {
  it("finds each campaign page by its slug", () => {
    expect(Object.keys(LANDING_PAGES)).toStrictEqual([
      "debt-consolidation",
      "digital-heloc",
      "home-renovation",
      "keep-your-rate",
    ]);
    expect(landingPage("debt-consolidation")?.title).toBe(
      "Consolidate debt with a HELOC"
    );
  });

  it("finds nothing for other slugs, including inherited object keys", () => {
    expect(landingPage("toString")).toBeUndefined();
    expect(landingPage()).toBeUndefined();
    expect(landingPage("heloc")).toBeUndefined();
    expect(landingPage("digital-heloc")?.headlineAccent).toBe(
      "5 business days.¹"
    );
  });

  it("marks exactly the footnotes each page shows", () => {
    for (const page of Object.values(LANDING_PAGES)) {
      const used = MARKERS.filter((marker) => pageText(page).includes(marker));
      expect(used).toStrictEqual(MARKERS.slice(0, page.notes.length));
    }
  });

  it("keeps the renovation planner and nothing else below the application", () => {
    const sections = Object.entries(LANDING_PAGES).flatMap(([slug, page]) =>
      "sections" in page
        ? page.sections.map((block) => `${slug}:${block._type}`)
        : []
    );
    expect(sections).toStrictEqual(["home-renovation:renovation_planner"]);
  });

  it("qualifies every soft-check claim and never says calendar days or sales calls", () => {
    const all = Object.values(LANDING_PAGES).map(pageText).join(" ");
    expect(all).not.toMatch(/5 days|no sales calls|Soft credit check only/iu);
    expect(LANDING_PAGES["debt-consolidation"].points[0]?.text).toBe(
      SOFT_CHECK
    );
  });
});
