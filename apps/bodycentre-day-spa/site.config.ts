import { studio } from "../../stacks/config.ts";

/**
 * Everything that makes this site *this* site (as opposed to the template):
 * identity, domain, business facts for structured data, and contact routing.
 * Copy is NOT here: editors own it in EmDash (see seed/seed.json). Structurally
 * a `SiteIdentity` (checked where alchemy.run.ts passes it to `resolveStage`).
 *
 * A spec mock-up for a cold pitch, not a client site: it lives on a PR preview
 * only. Facts come from bodycentredayspa.com (Oct 2026); unknowns stay out.
 */
interface BusinessFacts {
  readonly address: {
    readonly street: string;
    readonly city: string;
    readonly region: string;
    readonly postalCode: string;
  };
  readonly areaServed: readonly string[];
  readonly email?: string;
  /** Their own booking page, which embeds the Mindbody scheduler. */
  readonly bookingUrl: string;
  /** Opens the address in the visitor's maps app or Google Maps. */
  readonly mapUrl: string;
  readonly telephone?: string;
}

const business: BusinessFacts = {
  address: {
    city: "Costa Mesa",
    postalCode: "92626",
    region: "CA",
    street: "801 Baker St., Suite E",
  },
  areaServed: ["Orange County, CA"],
  bookingUrl: "https://www.bodycentredayspa.com/book-now",
  email: "kelley@bodycentredayspa.com",
  mapUrl:
    "https://www.google.com/maps/search/?api=1&query=BodyCentre+Day+Spa+801+Baker+St+Suite+E+Costa+Mesa+CA+92626",
  telephone: "+1-714-668-9925",
};

export const site = {
  business,

  description:
    "Massage, facials, and recovery therapies in Costa Mesa since 1994. Book online or call (714) 668-9925.",

  /** Appended to meta descriptions too short for a search snippet (see `metaDescription`). */
  descriptionContext:
    "BodyCentre Day Spa, 801 Baker St., Suite E, Costa Mesa, California.",

  /**
   * Never set for this mock-up: with no domain, `main` ships no prod stage,
   * and every other stage answers with `X-Robots-Tag: noindex, nofollow`
   * (src/worker.ts), which keeps the demo out of search.
   */
  domain: null,

  /** Prefixes Worker names (`bodycentre-day-spa-<stage>`) and the Alchemy stack. */
  id: "bodycentre-day-spa",

  // No form on the page, so nothing is ever routed here.
  leadInbox: [],

  /**
   * Public base URL EmDash downloads seed images from when the stage cannot
   * serve them itself (local workerd: EmDash's SSRF guard refuses localhost).
   * Deployed stages use their own `/_seed/media`.
   */
  localSeedMediaBase:
    "https://bodycentre-day-spa-staging.jbolabs.com/_seed/media",

  name: "BodyCentre Day Spa",

  /** Display form of `business.telephone`. */
  phone: "(714) 668-9925",

  shortName: "BodyCentre",

  stagingBaseDomain: studio.domain,

  /** The Cloudflare account's workers.dev subdomain for developer previews. */
  workersSubdomain: "jakebodea",
} as const;
