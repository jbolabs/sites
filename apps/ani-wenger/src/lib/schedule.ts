/** EmDash publishes scheduled entries and runs maintenance from this every-minute tick. */
export const EMDASH_CRON = "* * * * *";

/** Daily backup (10:17 UTC, off the hour to avoid the top-of-hour rush). */
export const BACKUP_CRON = "17 10 * * *";

/**
 * Appointment reminders ride the minute tick, every quarter hour. A missed
 * tick is harmless: the next one sends whatever is still due.
 */
export const isReminderTick = (at: Date): boolean =>
  at.getUTCMinutes() % 15 === 0;

/**
 * Ani's work calendar is read every five minutes on the minute tick, so a
 * client she books by text is blocked online within minutes. A missed tick
 * only means the next one reads it.
 */
export const isOutsideCalendarTick = (at: Date): boolean =>
  at.getUTCMinutes() % 5 === 0;
