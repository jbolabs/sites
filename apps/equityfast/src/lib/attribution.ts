/**
 * Ad attribution: which campaign brought the visitor. The base layout captures
 * it from any page whose URL carries ad parameters (the latest ad click wins),
 * keeps it on the device for 30 days, like the application draft, so a
 * visitor who leaves and comes back to finish still names the ad, and the
 * application sends it with the lead, so the CMS entry, the lead email and
 * Flow AG all name the campaign. A sent application clears it.
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
  "utm_id",
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
/** How long a saved ad click still names the campaign (Meta's longest click window). */
export const ATTRIBUTION_DAYS = 30;
const DAY_MS = 86_400_000;

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

const storage = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    // Storage disabled (private mode, policy): leads just carry no campaign.
    return undefined;
  }
};

/** `saved` unless it is older than the attribution window at `now`. */
export const unexpired = (
  saved: Attribution | undefined,
  now: Date
): Attribution | undefined => {
  if (saved === undefined) {
    return undefined;
  }
  const captured = Date.parse(saved.capturedAt ?? "");
  return Number.isNaN(captured) ||
    now.getTime() - captured > ATTRIBUTION_DAYS * DAY_MS
    ? undefined
    : saved;
};

/** The ad click that brought this visitor in the last 30 days, if any. */
export const readAttribution = (): Attribution | undefined => {
  try {
    const saved = storage()?.getItem(STORAGE_KEY);
    return saved === null || saved === undefined
      ? undefined
      : unexpired(
          attributionFromParams(new URLSearchParams(saved)),
          new Date()
        );
  } catch {
    return undefined;
  }
};

/**
 * Saves the current page's attribution when its URL carries ad parameters,
 * replacing an earlier click. A plain page view (a later click inside the
 * site, a return visit) keeps the saved ad.
 */
export const captureAttribution = (): void => {
  try {
    const attribution = attributionFromVisit({
      now: new Date(),
      pathname: window.location.pathname,
      referrer: document.referrer,
      search: window.location.search,
    });
    if (attribution !== undefined) {
      storage()?.setItem(
        STORAGE_KEY,
        new URLSearchParams(Object.entries(attribution)).toString()
      );
    }
  } catch {
    // Quota exceeded or storage blocked: attribution is best effort.
  }
};

/** Forgets the saved ad once its application is sent. */
export const clearAttribution = (): void => {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: nothing was saved.
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
    const label = parts.join(" / ");
    return attribution.utm_id === undefined || attribution.utm_id === ""
      ? label
      : `${label} (campaign ID ${attribution.utm_id})`;
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
        ["utm_id", attribution?.utm_id],
      ] as const
    ).flatMap(([key, value]) => (value === undefined ? [] : [[key, value]]))
  );
