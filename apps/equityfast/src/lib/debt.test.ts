import { describe, expect, it } from "vitest";

import { balanceCeiling, debtTotals } from "./debt.ts";

describe(debtTotals, () => {
  it("compares a year of interest today with one line at the HELOC rate", () => {
    // $18,000 at 24% is $360/mo; $12,000 at 12% is $120/mo: $480/mo today.
    // $30,000 at 8% is $200/mo, so $280/mo or $3,360 a year saved.
    const totals = debtTotals(
      [
        { aprPercent: 24, balance: 18_000 },
        { aprPercent: 12, balance: 12_000 },
      ],
      8
    );
    expect(totals).toMatchObject({
      balance: 30_000,
      monthlyToday: 480,
      monthlyWithLine: 200,
      savedPerYear: 3360,
    });
    expect(totals.blendedApr).toBeCloseTo(19.2, 6);
  });

  it("never shows a negative saving when the line costs more", () => {
    const totals = debtTotals([{ aprPercent: 6, balance: 12_000 }], 9);
    expect(totals.savedPerYear).toBe(0);
    expect(totals.monthlyWithLine).toBe(90);
  });

  it("has no blended rate before anything is entered", () => {
    const totals = debtTotals([], 8);
    expect(totals.blendedApr).toBeUndefined();
    expect(totals.balance).toBe(0);
  });
});

describe(balanceCeiling, () => {
  it("lets the slider reach four times the typical balance, at least $50,000", () => {
    expect(balanceCeiling(3000)).toBe(50_000);
    expect(balanceCeiling(22_000)).toBe(88_000);
  });
});
