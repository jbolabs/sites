import { describe, expect, it } from "vitest";

import {
  adEventParams,
  attributionFromParams,
  attributionFromVisit,
  campaignLabel,
} from "./attribution.ts";

const now = new Date("2026-11-11T17:30:00.000Z");

describe(attributionFromVisit, () => {
  it("captures a Meta ad click with its landing page and referrer, dropping the referrer's query", () => {
    expect(
      attributionFromVisit({
        now,
        pathname: "/lp/debt-consolidation",
        referrer:
          "https://l.facebook.com/l.php?u=https%3A%2F%2Fequityfast.homes",
        search:
          "?utm_source=facebook&utm_medium=paid_social&utm_campaign=debt-consolidation&utm_content=%20card-a%20&utm_id=120210000000001&fbclid=IwAR0abc&ref=ignored",
      })
    ).toStrictEqual({
      capturedAt: "2026-11-11T17:30:00.000Z",
      fbclid: "IwAR0abc",
      landingPage: "/lp/debt-consolidation",
      referrer: "https://l.facebook.com/l.php",
      utm_campaign: "debt-consolidation",
      utm_content: "card-a",
      utm_id: "120210000000001",
      utm_medium: "paid_social",
      utm_source: "facebook",
    });
  });

  it("captures a Google Ads auto-tagged click with no referrer", () => {
    expect(
      attributionFromVisit({
        now,
        pathname: "/lp/digital-heloc",
        referrer: "",
        search: "?gclid=Cj0KCQ",
      })
    ).toStrictEqual({
      capturedAt: "2026-11-11T17:30:00.000Z",
      gclid: "Cj0KCQ",
      landingPage: "/lp/digital-heloc",
    });
  });

  it("captures nothing from a visit without ad parameters", () => {
    const visit = {
      now,
      pathname: "/heloc",
      referrer: "https://www.google.com/",
      search: "?q=heloc&utm_source=%20%20",
    };
    expect(attributionFromVisit(visit)).toBeUndefined();
    expect(
      attributionFromVisit({ ...visit, search: "?utm_source=google" })
    ).toMatchObject({
      referrer: "https://www.google.com/",
      utm_source: "google",
    });
  });

  it("cuts each parameter to 200 characters", () => {
    const captured = attributionFromVisit({
      now,
      pathname: "/lp/keep-your-rate",
      referrer: "",
      search: `?utm_campaign=${"a".repeat(250)}`,
    });
    expect(captured?.utm_campaign).toBe("a".repeat(200));
  });
});

describe(attributionFromParams, () => {
  it("reads back a saved capture, keeping only the known fields", () => {
    expect(
      attributionFromParams(
        new URLSearchParams(
          "email=jordan%40example.com&landingPage=%2Flp%2Fhome-renovation&utm_source=facebook&utm_medium="
        )
      )
    ).toStrictEqual({
      landingPage: "/lp/home-renovation",
      utm_source: "facebook",
    });
  });

  it("drops a saved value with no ad parameter left", () => {
    expect(
      attributionFromParams(new URLSearchParams("landingPage=%2Flp%2Fx"))
    ).toBeUndefined();
    expect(
      attributionFromParams(new URLSearchParams("gclid=abc"))
    ).toStrictEqual({ gclid: "abc" });
  });
});

describe(campaignLabel, () => {
  it("names the campaign by its UTM values in order", () => {
    expect(
      campaignLabel({
        utm_campaign: "debt-consolidation",
        utm_content: "card-a",
        utm_medium: "paid_social",
        utm_source: "facebook",
      })
    ).toBe("facebook / paid_social / debt-consolidation / card-a");
  });

  it("adds the ad platform's campaign ID when the ad sends one", () => {
    expect(
      campaignLabel({
        utm_campaign: "debt-consolidation",
        utm_id: "120210000000001",
        utm_source: "facebook",
      })
    ).toBe("facebook / debt-consolidation (campaign ID 120210000000001)");
  });

  it("falls back to the click id when there are no UTM values", () => {
    expect(campaignLabel({ gclid: "Cj0KCQ" })).toBe("Google Ads click (gclid)");
    expect(campaignLabel({ fbclid: "IwAR0abc" })).toBe(
      "Facebook click (fbclid)"
    );
    expect(campaignLabel()).toBeUndefined();
  });
});

describe(adEventParams, () => {
  it("passes the landing page and UTM values to Tag Manager, not click ids", () => {
    expect(
      adEventParams({
        fbclid: "IwAR0abc",
        landingPage: "/lp/debt-consolidation",
        utm_campaign: "debt-consolidation",
        utm_id: "120210000000001",
        utm_source: "facebook",
      })
    ).toStrictEqual({
      landing_page: "/lp/debt-consolidation",
      utm_campaign: "debt-consolidation",
      utm_id: "120210000000001",
      utm_source: "facebook",
    });
    expect(adEventParams()).toStrictEqual({});
  });
});
