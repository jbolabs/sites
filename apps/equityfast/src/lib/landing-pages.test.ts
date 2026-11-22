import { describe, expect, it } from "vitest";

import { LANDING_PAGES, landingPage } from "./landing-pages.ts";
import type { LandingPage } from "./landing-pages.ts";

const pageText = (page: LandingPage) =>
  [page.headline, page.headlineAccent, page.benefit, ...page.points].join(" ");

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
    expect(landingPage("digital-heloc")?.headlineAccent).toBe(
      "5 business days.*"
    );
  });

  it("gives an ad's own asterisk line only to pages that use an asterisk", () => {
    const pages: readonly LandingPage[] = Object.values(LANDING_PAGES);
    const withNote = pages.filter((page) => page.note !== undefined);
    expect(withNote.map((page) => page.note?.startsWith("*"))).not.toContain(
      false
    );
    expect(
      withNote.filter((page) => !pageText(page).includes("*"))
    ).toHaveLength(0);
  });

  it("shows the matching calculator on the debt and renovation pages only", () => {
    const pages: readonly [string, LandingPage][] =
      Object.entries(LANDING_PAGES);
    const withCalculator = pages
      .filter(([, page]) => page.calculator !== undefined)
      .map(([slug, page]) => [slug, page.calculator]);
    expect(withCalculator).toStrictEqual([
      ["debt-consolidation", "debt_calculator"],
      ["home-renovation", "renovation_planner"],
    ]);
  });
});
