import { describe, expect, it } from "vitest";

import { adminDashboardCss } from "./dashboard.ts";

const DASHBOARD =
  "html[data-theme] main div:has(> div > h1):has(> div > [data-testid=dashboard-metric])";

describe(adminDashboardCss, () => {
  it("puts the plugin cards right under the title", () => {
    expect(adminDashboardCss({ widgetsFirst: true })).toBe(
      [
        `${DASHBOARD}{display:flex;flex-direction:column;gap:1.5rem}`,
        `${DASHBOARD} > *{margin-block:0}`,
        `${DASHBOARD} > div:has(> h1){order:-2}`,
        `${DASHBOARD} > :last-child{order:-1}`,
      ].join("\n")
    );
  });

  it("leaves EmDash's order alone by default", () => {
    expect(adminDashboardCss()).toBe("");
    expect(adminDashboardCss({ widgetsFirst: false })).toBe("");
  });
});
