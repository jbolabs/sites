/**
 * Debt consolidation calculator math, matching E Mortgage Capital's own
 * calculator: today's monthly payments against one fully amortizing payment
 * on the same total at an example fixed rate, with no fees. The disclaimer
 * says so, and that real HELOC rates are usually variable.
 */
export const TERMS_YEARS = [5, 10, 15, 20, 30] as const;
export type TermYears = (typeof TERMS_YEARS)[number];

export interface Consolidation {
  /** The one monthly payment. */
  readonly payment: number;
  /** How much lower it is than today's payments, never below zero. */
  readonly savedPerMonth: number;
  readonly totalPaid: number;
  readonly interest: number;
}

/** The fully amortizing monthly payment on `principal` at `ratePercent` APR. */
export const monthlyPayment = (
  principal: number,
  ratePercent: number,
  years: number
): number => {
  const months = years * 12;
  const rate = ratePercent / 100 / 12;
  if (rate === 0) {
    return principal / months;
  }
  return (principal * rate) / (1 - (1 + rate) ** -months);
};

export const consolidate = ({
  debt,
  paymentsNow,
  ratePercent,
  years,
}: {
  readonly debt: number;
  readonly paymentsNow: number;
  readonly ratePercent: number;
  readonly years: number;
}): Consolidation => {
  const payment = monthlyPayment(debt, ratePercent, years);
  const totalPaid = payment * years * 12;
  return {
    interest: totalPaid - debt,
    payment,
    savedPerMonth: Math.max(0, paymentsNow - payment),
    totalPaid,
  };
};
