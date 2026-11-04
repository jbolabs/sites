import { describe, expect, it } from "vitest";

import { llmsText } from "./llms";

describe(llmsText, () => {
  it("lists facts, pages, and projects as llms.txt Markdown", () => {
    expect(
      llmsText({
        description: "Design-build remodeling in Orange County.",
        facts: ["Phone: 714-873-3473", "Serves Orange County, CA"],
        name: "Stud Construction",
        origin: "https://example.com",
        pages: [
          {
            path: "/",
            summary: "Remodels,\n  start to finish.",
            title: "Home",
          },
          { path: "/privacy", title: "Privacy" },
        ],
        projects: [
          {
            location: "Tustin",
            path: "/projects/tuscan-abode",
            summary: "A double curved staircase.",
            title: "Tuscan Abode",
            type: "Whole-home remodel",
          },
          {
            path: "/projects/pet-haven",
            title: "Pet Haven",
            type: "Commercial",
          },
        ],
      })
    ).toBe(
      [
        "# Stud Construction",
        "",
        "> Design-build remodeling in Orange County.",
        "",
        "- Phone: 714-873-3473",
        "- Serves Orange County, CA",
        "",
        "## Pages",
        "",
        "- [Home](https://example.com/): Remodels, start to finish.",
        "- [Privacy](https://example.com/privacy)",
        "",
        "## Projects",
        "",
        "- [Tuscan Abode](https://example.com/projects/tuscan-abode): Whole-home remodel in Tustin. A double curved staircase.",
        "- [Pet Haven](https://example.com/projects/pet-haven): Commercial",
        "",
      ].join("\n")
    );
  });
});
