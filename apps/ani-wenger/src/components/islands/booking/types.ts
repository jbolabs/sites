/** What the booking page hands the island, and what the server sends back. */
export interface ServiceOption {
  readonly slug: string;
  readonly title: string;
  readonly category: string;
  readonly categoryLabel: string;
  readonly summary: string;
  readonly duration: string;
  readonly price: string | undefined;
}

export interface Slot {
  readonly start: string;
  readonly minutes: number;
}

export interface Day {
  readonly date: string;
  readonly slots: readonly Slot[];
}

export interface Confirmation {
  readonly id: string;
  readonly service: string;
  readonly start: string;
  readonly end: string;
  readonly location: string;
  readonly manageUrl: string;
  readonly calendarUrl: string;
  readonly googleCalendarUrl: string;
}
