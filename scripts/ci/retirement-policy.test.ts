import { describe, expect, it } from "vitest";

import { forceEmptyBucket, retirementSite } from "./retirement-policy.ts";

describe(retirementSite, () => {
  it("accepts reviewed stages and refuses their neighbours", () => {
    expect(() => {
      retirementSite("AccessElectric", "live_jakebodea");
    }).not.toThrow();
    expect(() => {
      retirementSite("agape-church", "pr-52");
    }).not.toThrow();
    expect(() => {
      retirementSite("access-electric", "staging");
    }).toThrow("Refusing retirement of access-electric/staging");
  });

  it.each([
    ["equityfast", "prod"],
    ["access-electric", "staging"],
    ["ms-custom-homes", "preview"],
    ["agape-church", "pr-53"],
    ["jbolabs", "prod"],
    ["", "prod"],
  ])("refuses %s/%s", (site, stage) => {
    expect(() => {
      retirementSite(site, stage);
    }).toThrow(`Refusing retirement of ${site}/${stage}`);
  });

  it("force-empties only the recorded legacy buckets", () => {
    expect(forceEmptyBucket("BlackSwanRealty", "live_jakebodea")).toBe(
      "blackswanrealty-bucket-live-jakebodea-fmt3sbj54itxgzt5"
    );
    expect(forceEmptyBucket("access-electric", "prod")).toBeUndefined();
  });
});
