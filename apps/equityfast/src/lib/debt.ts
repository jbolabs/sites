/**
 * Debt consolidation calculator math. It compares interest only: what the
 * balances cost each month at their own rates against the same total at one
 * example HELOC rate. Payments are left out on purpose, since they depend on
 * terms the visitor hasn't chosen.
 */
export interface Debt {
  readonly balance: number;
  /** Annual rate as a percentage: 24.9 means 24.9% APR. */
  readonly aprPercent: number;
}

export interface DebtTotals {
  readonly balance: number;
  /** Monthly interest on the debts at their own rates. */
  readonly monthlyToday: number;
  /** Monthly interest on the same total at the HELOC rate. */
  readonly monthlyWithLine: number;
  /** Interest saved over a year, never below zero. */
  readonly savedPerYear: number;
  /** Balance-weighted APR, or undefined with nothing entered. */
  readonly blendedApr: number | undefined;
}

const monthly = (balance: number, aprPercent: number) =>
  (balance * aprPercent) / 100 / 12;

export const debtTotals = (
  debts: readonly Debt[],
  lineRatePercent: number
): DebtTotals => {
  const balance = debts.reduce((sum, debt) => sum + debt.balance, 0);
  const monthlyToday = debts.reduce(
    (sum, debt) => sum + monthly(debt.balance, debt.aprPercent),
    0
  );
  const monthlyWithLine = monthly(balance, lineRatePercent);
  return {
    balance,
    blendedApr: balance > 0 ? (monthlyToday * 12 * 100) / balance : undefined,
    monthlyToday,
    monthlyWithLine,
    savedPerYear: Math.max(0, (monthlyToday - monthlyWithLine) * 12),
  };
};

/** Balance slider ceiling: at least $50,000, or four times the typical balance. */
export const balanceCeiling = (typicalBalance: number): number =>
  Math.max(50_000, typicalBalance * 4);
