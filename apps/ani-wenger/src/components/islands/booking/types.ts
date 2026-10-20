/** What the booking page hands the island, and what the server sends back. */
export interface ServiceOption {
  readonly slug: string;
  readonly title: string;
  readonly category: string;
  readonly categoryLabel: string;
  readonly summary: string;
  readonly audience: "women" | "men" | "everyone";
  /** Only booked together with a main service. */
  readonly addOn: boolean;
  readonly asksForPhotos: boolean;
  /** The service to suggest when the client's hair needs color removed first. */
  readonly colorCorrection: boolean;
  readonly durationMinutes: number;
  readonly bufferMinutes: number;
  /** Dollars; 0 is complimentary, absent is unlisted. */
  readonly price?: number | undefined;
  readonly priceFrom: boolean;
}

export type Audience = "women" | "men";

/** A photo the client added, already shrunk to a JPEG in the browser. */
export interface HairPhoto {
  readonly id: string;
  readonly kind: "now" | "goal";
  /** Base64 JPEG, as the server takes it. */
  readonly data: string;
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
