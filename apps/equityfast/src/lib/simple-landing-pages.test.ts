import { describe, expect, it } from "vitest";

import { LANDING_PAGES } from "./landing-pages.ts";
import {
  SIMPLE_LANDING_PAGES,
  simpleLandingPage,
} from "./simple-landing-pages.ts";

describe(simpleLandingPage, () => {
  it("has a simplified version of each campaign page, with the same title", () => {
    expect(Object.keys(SIMPLE_LANDING_PAGES)).toStrictEqual(
      Object.keys(LANDING_PAGES)
    );
    expect(simpleLandingPage("keep-your-rate")?.title).toBe(
      LANDING_PAGES["keep-your-rate"].title
    );
  });

  it("finds nothing for other slugs, including inherited object keys", () => {
    expect(simpleLandingPage("toString")).toBeUndefined();
    expect(simpleLandingPage()).toBeUndefined();
    expect(simpleLandingPage("heloc")).toBeUndefined();
    expect(simpleLandingPage("digital-heloc")?.headlineAccent).toBe(
      "5 business days.*"
    );
  });

  it("keeps the renovation planner and nothing else below the application", () => {
    const sections = Object.entries(SIMPLE_LANDING_PAGES).flatMap(
      ([slug, page]) =>
        "sections" in page
          ? page.sections.map((block) => `${slug}:${block._type}`)
          : []
    );
    expect(sections).toStrictEqual(["home-renovation:renovation_planner"]);
  });
});
