import { describe, expect, it } from "vitest";

import { consolidate, monthlyPayment } from "./debt.ts";

describe(consolidate, () => {
  it("matches E Mortgage Capital's calculator for $129,000 at 8.5% over 15 years", () => {
    // Their calculator shows $1,270/mo, $2,905 less than $4,175, and
    // $228,657 paid in total including $99,657 interest.
    const result = consolidate({
      debt: 129_000,
      paymentsNow: 4175,
      ratePercent: 8.5,
      years: 15,
    });
    expect(Math.round(result.payment)).toBe(1270);
    expect(Math.round(result.savedPerMonth)).toBe(2905);
    expect(Math.round(result.totalPaid)).toBe(228_657);
    expect(Math.round(result.interest)).toBe(99_657);
  });

  it("never shows a negative saving when one payment costs more", () => {
    const result = consolidate({
      debt: 35_000,
      paymentsNow: 300,
      ratePercent: 8.5,
      years: 5,
    });
    expect(result.savedPerMonth).toBe(0);
    expect(Math.round(result.payment)).toBe(718);
  });
});

describe(monthlyPayment, () => {
  it("splits the balance evenly at a 0% rate", () => {
    expect(monthlyPayment(12_000, 0, 5)).toBe(200);
  });
});
