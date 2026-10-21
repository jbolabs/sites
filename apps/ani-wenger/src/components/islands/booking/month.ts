/** Month arithmetic on `YYYY-MM-01` strings for the booking calendar. */
import { daysBetween } from "@/lib/booking/calendar";

export const monthStart = (date: string) => `${date.slice(0, 7)}-01`;

export const nextMonth = (month: string) => {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7));
  return index === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(index + 1).padStart(2, "0")}-01`;
};

export const previousMonth = (month: string) => {
  const year = Number(month.slice(0, 4));
  const index = Number(month.slice(5, 7));
  return index === 1
    ? `${year - 1}-12-01`
    : `${year}-${String(index - 1).padStart(2, "0")}-01`;
};

export const daysInMonth = (month: string) =>
  daysBetween(month, nextMonth(month));

export const monthsAhead = (month: string, count: number) => {
  let result = month;
  for (let step = 0; step < count; step += 1) {
    result = nextMonth(result);
  }
  return result;
};

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

export const monthLabel = (month: string) =>
  MONTH_LABEL.format(new Date(`${month}T12:00:00Z`));
