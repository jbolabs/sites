import { describe, expect, it } from "vitest";

import { funnelPayload, pageOf } from "./funnel.ts";

const now = new Date("2026-11-24T19:00:00.000Z");
const page = {
  host: "equityfast.homes",
  pathname: "/lp/digital-heloc",
  referrer: "https://l.facebook.com/l.php",
  url: "https://equityfast.homes/lp/digital-heloc",
};

describe(funnelPayload, () => {
  it("sends an anonymous step event with the page and the ad that brought the visit", () => {
    expect(
      funnelPayload({
        attribution: {
          capturedAt: "2026-11-24T18:55:00.000Z",
          landingPage: "/lp/digital-heloc",
          utm_campaign: "Home Equity / HELOC",
          utm_source: "facebook",
        },
        environment: "production",
        event: "application_step",
        key: "phc_test",
        now,
        page,
        properties: { step: "contact", step_number: 3 },
        visit: "visit-1",
      })
    ).toStrictEqual({
      api_key: "phc_test",
      distinct_id: "visit-1",
      event: "application_step",
      properties: {
        $current_url: "https://equityfast.homes/lp/digital-heloc",
        $host: "equityfast.homes",
        $lib: "equityfast-web",
        $pathname: "/lp/digital-heloc",
        $process_person_profile: false,
        $referrer: "https://l.facebook.com/l.php",
        environment: "production",
        landing_page: "/lp/digital-heloc",
        step: "contact",
        step_number: 3,
        utm_campaign: "Home Equity / HELOC",
        utm_source: "facebook",
      },
      timestamp: "2026-11-24T19:00:00.000Z",
    });
  });

  it("sends a page view with no ad properties when the visit has none", () => {
    expect(
      funnelPayload({
        environment: "production",
        event: "$pageview",
        key: "phc_test",
        now,
        page,
        properties: {},
        visit: "visit-2",
      }).properties
    ).toStrictEqual({
      $current_url: "https://equityfast.homes/lp/digital-heloc",
      $host: "equityfast.homes",
      $lib: "equityfast-web",
      $pathname: "/lp/digital-heloc",
      $process_person_profile: false,
      $referrer: "https://l.facebook.com/l.php",
      environment: "production",
    });
  });
});

describe(pageOf, () => {
  it("keeps the origin and path and drops the query", () => {
    expect(pageOf("https://www.google.com/search?q=heloc")).toBe(
      "https://www.google.com/search"
    );
  });

  it("calls an empty or odd referrer direct", () => {
    expect(pageOf("")).toBe("$direct");
    expect(pageOf("android-app://com.facebook")).toBe("$direct");
  });
});
