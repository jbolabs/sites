/** The church's time zone: announcements end at midnight in Yorba Linda, not UTC. */
export const CHURCH_TIME_ZONE = "America/Los_Angeles";

/** `en-CA` formats dates as `YYYY-MM-DD`. */
const CHURCH_DATE = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: CHURCH_TIME_ZONE,
  year: "numeric",
});

/** `now` as the church's calendar date, `YYYY-MM-DD`. */
export const churchDate = (now: Date): string => CHURCH_DATE.format(now);

/**
 * Whether an announcement still shows on `today`. It runs through the whole
 * of its end date; one without an end date never expires. Both dates are
 * `YYYY-MM-DD`, so they compare as strings.
 */
export const isCurrent = (
  endsOn: string | null | undefined,
  today: string
): boolean =>
  endsOn === null || endsOn === undefined || endsOn === "" || endsOn >= today;
