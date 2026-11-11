/**
 * Ad attribution: which campaign brought the visitor. The base layout captures
 * it on the first page of a visit that carries ad parameters (first touch),
 * keeps it for the browser session, and the application sends it with the
 * lead, so the CMS entry, the lead email and Flow AG all name the campaign.
 *
 * Plain browser code (no Effect): the layout's script and the application
 * island import it. The server checks the same limits in `application.ts`.
 * Stored as URL-encoded text, like the application draft: every field is a
 * string, so reading it back needs no shape checks.
 */

/** The URL parameters that mark a visit from an ad. */
export const AD_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
] as const;
type AdParam = (typeof AD_PARAMS)[number];

/** Longest kept value of an ad parameter. */
export const MAX_PARAM_LENGTH = 200;
/** Longest kept landing page or referrer (a path, or an origin and path). */
export const MAX_URL_LENGTH = 500;

type VisitField = "landingPage" | "referrer" | "capturedAt";

export type Attribution = {
  readonly [param in AdParam]?: string;
} & {
  /** Path of the page the visitor landed on, no query. */
  readonly landingPage?: string;
  /** Origin and path of the page that sent them, no query. */
  readonly referrer?: string;
  /** ISO time of the capture. */
  readonly capturedAt?: string;
};

/** Every field kept, with its length limit. */
const LIMITS: ReadonlyMap<AdParam | VisitField, number> = new Map([
  ...AD_PARAMS.map((param) => [param, MAX_PARAM_LENGTH] as const),
  ["landingPage", MAX_URL_LENGTH],
  ["referrer", MAX_URL_LENGTH],
  ["capturedAt", MAX_PARAM_LENGTH],
]);

const STORAGE_KEY = "equityfast.attribution";

/**
 * The known fields of `params`, trimmed and cut to their limits; undefined
 * when no ad parameter is left (a plain visit carries no campaign).
 */
export const attributionFromParams = (
  params: URLSearchParams
): Attribution | undefined => {
  const entries = [...LIMITS].flatMap(([field, max]) => {
    const value = (params.get(field) ?? "").trim().slice(0, max);
    return value === "" ? [] : [[field, value] as const];
  });
  const fromAd = entries.some(([field]) =>
    AD_PARAMS.some((param) => param === field)
  );
  return fromAd ? Object.fromEntries(entries) : undefined;
};

/** `https://host/path` of a referrer URL, dropping its query and hash. */
const referrerOf = (referrer: string): string => {
  try {
    const url = new URL(referrer);
    return url.protocol === "https:" || url.protocol === "http:"
      ? `${url.origin}${url.pathname}`
      : "";
  } catch {
    return "";
  }
};

export interface Visit {
  /** `location.search`. */
  readonly search: string;
  /** `location.pathname`. */
  readonly pathname: string;
  /** `document.referrer` (empty when there is none). */
  readonly referrer: string;
  readonly now: Date;
}

/** The attribution a page view carries, or undefined when its URL has no ad parameter. */
export const attributionFromVisit = (visit: Visit): Attribution | undefined => {
  const query = new URLSearchParams(visit.search);
  const params = new URLSearchParams({
    capturedAt: visit.now.toISOString(),
    landingPage: visit.pathname,
    referrer: referrerOf(visit.referrer),
  });
  for (const param of AD_PARAMS) {
    params.set(param, query.get(param) ?? "");
  }
  return attributionFromParams(params);
};

const session = (): Storage | undefined => {
  try {
    return window.sessionStorage;
  } catch {
    // Storage disabled (private mode, policy): leads just carry no campaign.
    return undefined;
  }
};

/** This session's first-touch attribution, if one was captured. */
export const readAttribution = (): Attribution | undefined => {
  try {
    const saved = session()?.getItem(STORAGE_KEY);
    return saved === null || saved === undefined
      ? undefined
      : attributionFromParams(new URLSearchParams(saved));
  } catch {
    return undefined;
  }
};

/**
 * Saves the current page's attribution unless this session already has one
 * (first touch wins: a later click inside the site keeps the ad that brought
 * the visitor).
 */
export const captureAttribution = (): void => {
  try {
    const storage = session();
    if (storage === undefined || storage.getItem(STORAGE_KEY) !== null) {
      return;
    }
    const attribution = attributionFromVisit({
      now: new Date(),
      pathname: window.location.pathname,
      referrer: document.referrer,
      search: window.location.search,
    });
    if (attribution !== undefined) {
      storage.setItem(
        STORAGE_KEY,
        new URLSearchParams(Object.entries(attribution)).toString()
      );
    }
  } catch {
    // Quota exceeded or storage blocked: attribution is best effort.
  }
};

/** One line naming the campaign, e.g. `facebook / paid_social / debt-consolidation`. */
export const campaignLabel = (
  attribution?: Attribution
): string | undefined => {
  if (attribution === undefined) {
    return undefined;
  }
  const parts = [
    attribution.utm_source,
    attribution.utm_medium,
    attribution.utm_campaign,
    attribution.utm_content,
    attribution.utm_term,
  ].filter((part) => part !== undefined && part !== "");
  if (parts.length > 0) {
    return parts.join(" / ");
  }
  if (attribution.gclid !== undefined) {
    return "Google Ads click (gclid)";
  }
  if (attribution.fbclid !== undefined) {
    return "Facebook click (fbclid)";
  }
  return undefined;
};

/**
 * The campaign as Tag Manager event parameters: `landing_page` and the
 * `utm_*` values, only those known. Never form answers.
 */
export const adEventParams = (
  attribution?: Attribution
): Record<string, string> =>
  Object.fromEntries(
    (
      [
        ["landing_page", attribution?.landingPage],
        ["utm_source", attribution?.utm_source],
        ["utm_medium", attribution?.utm_medium],
        ["utm_campaign", attribution?.utm_campaign],
        ["utm_content", attribution?.utm_content],
        ["utm_term", attribution?.utm_term],
      ] as const
    ).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]]))
  );
