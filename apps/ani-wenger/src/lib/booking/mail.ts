/**
 * The words in booking emails. Plain text: it reads well in every inbox and
 * on every phone, and nothing in it can break.
 */
import { formatDate, formatTime, toLocal } from "./calendar.ts";

export interface MailAppointment {
  readonly clientName: string;
  readonly email: string | undefined;
  readonly phone: string | undefined;
  readonly notes: string | undefined;
  readonly service: string;
  readonly start: Date;
  readonly durationMinutes: number;
}

export interface MailContext {
  readonly siteName: string;
  readonly timeZone: string;
  readonly location: string;
  readonly phone: string;
}

/** "Tuesday, October 27 at 9:30 AM" in the salon's time zone. */
export const whenText = (start: Date, timeZone: string): string => {
  const local = toLocal(start, timeZone);
  return `${formatDate(local.date)} at ${formatTime(local.minutes)}`;
};

const firstName = (name: string) => name.trim().split(/\s+/u)[0] ?? name;

export const confirmationMail = (
  appointment: MailAppointment,
  context: MailContext & {
    readonly manageUrl: string;
    readonly calendarUrl: string;
    readonly bookingNote: string;
  }
) => ({
  subject: `Booked: ${appointment.service}, ${whenText(appointment.start, context.timeZone)}`,
  text: [
    `Hi ${firstName(appointment.clientName)},`,
    "",
    "Thank you for booking. Here are your details:",
    "",
    appointment.service,
    `${whenText(appointment.start, context.timeZone)} (about ${appointment.durationMinutes} minutes)`,
    context.location,
    "",
    `Add it to your calendar: ${context.calendarUrl}`,
    `Need to cancel? ${context.manageUrl}`,
    "",
    context.bookingNote,
    "",
    `Questions? Reply to this email or call ${context.phone}.`,
    "",
    "See you soon,",
    context.siteName,
  ].join("\n"),
});

export const studioNewBookingMail = (
  appointment: MailAppointment,
  context: MailContext & { readonly adminUrl: string }
) => ({
  subject: `New booking: ${appointment.clientName}, ${whenText(appointment.start, context.timeZone)}`,
  text: [
    `${appointment.clientName} booked ${appointment.service}.`,
    "",
    `When: ${whenText(appointment.start, context.timeZone)} (${appointment.durationMinutes} minutes)`,
    `Phone: ${appointment.phone ?? "-"}`,
    `Email: ${appointment.email ?? "-"}`,
    ...(appointment.notes === undefined
      ? []
      : ["", `Notes: ${appointment.notes}`]),
    "",
    `See your schedule: ${context.adminUrl}`,
  ].join("\n"),
});

export const clientCancelledMail = (
  appointment: MailAppointment,
  context: MailContext & { readonly bookUrl: string }
) => ({
  subject: `Cancelled: ${appointment.service}, ${whenText(appointment.start, context.timeZone)}`,
  text: [
    `Hi ${firstName(appointment.clientName)},`,
    "",
    `Your ${appointment.service} on ${whenText(appointment.start, context.timeZone)} is cancelled.`,
    "",
    `Whenever you are ready, book a new time here: ${context.bookUrl}`,
    "",
    context.siteName,
  ].join("\n"),
});

export const studioCancelledMail = (
  appointment: MailAppointment,
  context: MailContext
) => ({
  subject: `Cancelled: ${appointment.clientName}, ${whenText(appointment.start, context.timeZone)}`,
  text: [
    `${appointment.clientName} cancelled ${appointment.service} on ${whenText(appointment.start, context.timeZone)}.`,
    "The time is open again on the website.",
    "",
    `Phone: ${appointment.phone ?? "-"}`,
    `Email: ${appointment.email ?? "-"}`,
  ].join("\n"),
});

/** When Ani cancels from her schedule: an apology and an easy way back. */
export const studioCancelledForClientMail = (
  appointment: MailAppointment,
  context: MailContext & { readonly bookUrl: string }
) => ({
  subject: `Your appointment on ${whenText(appointment.start, context.timeZone)} is cancelled`,
  text: [
    `Hi ${firstName(appointment.clientName)},`,
    "",
    `I am sorry, but I have to cancel your ${appointment.service} on ${whenText(appointment.start, context.timeZone)}.`,
    "",
    `Please choose a new time here: ${context.bookUrl}`,
    `Or call me at ${context.phone} and I will find one for you.`,
    "",
    context.siteName,
  ].join("\n"),
});

/** Only the token's hash is stored, so the reminder points back to the confirmation's link. */
export const reminderMail = (
  appointment: MailAppointment,
  context: MailContext
) => ({
  subject: `Reminder: ${appointment.service} tomorrow`,
  text: [
    `Hi ${firstName(appointment.clientName)},`,
    "",
    `A reminder of your ${appointment.service} on ${whenText(appointment.start, context.timeZone)}.`,
    context.location,
    "",
    `If something has come up, please cancel with the link in your confirmation email, or call ${context.phone}, so someone else can have the time.`,
    "",
    "See you soon,",
    context.siteName,
  ].join("\n"),
});
