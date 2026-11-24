/**
 * Anonymous funnel events for PostHog: page views, and how far visitors get
 * through the application. No SDK, no cookies, no person profiles, no
 * autocapture or replay, and never a form answer: each browser tab gets a
 * random id, so a funnel can join one visit's steps and nothing more. The
 * base layout renders the project key in a meta tag only when the stage binds
 * one, so local dev sends nothing.
 *
 * Plain browser code (no Effect), like `attribution.ts`; the payload is built
 * by a pure function so it can be tested without a browser.
 */
import { adEventParams, readAttribution } from "./attribution.ts";
import type { Attribution } from "./attribution.ts";

/** PostHog's US capture endpoint (the project lives in PostHog's US cloud). */
export const CAPTURE_URL = "https://us.i.posthog.com/i/v0/e/";
/** Meta tags the base layout renders: the project key and the stage. */
export const KEY_META = "funnel-key";
export const ENVIRONMENT_META = "funnel-environment";

const VISIT_KEY = "equityfast.visit";

export type FunnelEvent =
  | "$pageview"
  | "application_step"
  | "application_submitted"
  | "application_failed";

export type FunnelProperties = Readonly<Record<string, string | number>>;

export interface FunnelPage {
  /** Origin and path, no query (ad parameters go in their own properties). */
  readonly url: string;
  readonly pathname: string;
  readonly host: string;
  /** Origin and path of the page that sent the visitor, or "$direct". */
  readonly referrer: string;
}

export interface FunnelCapture {
  readonly key: string;
  readonly event: FunnelEvent;
  readonly visit: string;
  readonly environment: string;
  readonly page: FunnelPage;
  readonly attribution?: Attribution | undefined;
  readonly properties: FunnelProperties;
  readonly now: Date;
}

/** The body PostHog's capture endpoint takes for one event. */
export const funnelPayload = ({
  attribution,
  environment,
  event,
  key,
  now,
  page,
  properties,
  visit,
}: FunnelCapture) => ({
  api_key: key,
  distinct_id: visit,
  event,
  properties: {
    $current_url: page.url,
    $host: page.host,
    $lib: "equityfast-web",
    $pathname: page.pathname,
    // Anonymous: PostHog keeps no person profile for these events.
    $process_person_profile: false,
    $referrer: page.referrer,
    environment,
    ...adEventParams(attribution),
    ...properties,
  },
  timestamp: now.toISOString(),
});

/** `https://host/path` of a URL, or "$direct" when there is none. */
export const pageOf = (url: string): string => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? `${parsed.origin}${parsed.pathname}`
      : "$direct";
  } catch {
    return "$direct";
  }
};

const meta = (name: string): string =>
  document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ??
  "";

let fallbackVisit: string | undefined;

/** This tab's random visit id (a fresh one per page if storage is blocked). */
const visitId = (): string => {
  try {
    const saved = window.sessionStorage.getItem(VISIT_KEY);
    if (saved !== null) {
      return saved;
    }
    const id = crypto.randomUUID();
    window.sessionStorage.setItem(VISIT_KEY, id);
    return id;
  } catch {
    fallbackVisit ??= crypto.randomUUID();
    return fallbackVisit;
  }
};

/** Posts one event; plain text needs no CORS preflight, keepalive outlives the page. */
const send = async (body: string): Promise<void> => {
  try {
    await fetch(CAPTURE_URL, {
      body,
      headers: { "Content-Type": "text/plain" },
      keepalive: true,
      method: "POST",
    });
  } catch {
    // A blocked or failed send is dropped: the visitor never notices.
  }
};

/** Sends one event; does nothing without a project key, and never throws. */
export const track = (
  event: FunnelEvent,
  properties: FunnelProperties = {}
): void => {
  try {
    const key = meta(KEY_META);
    if (key === "") {
      return;
    }
    const body = JSON.stringify(
      funnelPayload({
        attribution: readAttribution(),
        environment: meta(ENVIRONMENT_META),
        event,
        key,
        now: new Date(),
        page: {
          host: window.location.host,
          pathname: window.location.pathname,
          referrer: pageOf(document.referrer),
          url: pageOf(window.location.href),
        },
        properties,
        visit: visitId(),
      })
    );
    void send(body);
  } catch {
    // Analytics is best effort: it must never break the page or the form.
  }
};

const reportedSteps = new Set<string>();

/** Records reaching an application step, once per step per page. */
export const trackStep = (step: string, stepNumber: number): void => {
  if (reportedSteps.has(step)) {
    return;
  }
  reportedSteps.add(step);
  track("application_step", { step, step_number: stepNumber });
};
