import { studio } from "../../stacks/config.ts";

/**
 * Everything that makes this site *this* site (as opposed to the template):
 * identity, domain, church facts for structured data, and contact routing.
 * Copy is NOT here: editors own it in EmDash (see seed/seed.json). Structurally
 * a `SiteIdentity` (checked where alchemy.run.ts passes it to `resolveStage`).
 */
/** Facts for Church JSON-LD. Leave unknown fields out rather than guessing. */
interface ChurchFacts {
  readonly address: {
    readonly street: string;
    readonly city: string;
    readonly region: string;
    readonly postalCode: string;
  };
  readonly email?: string;
  readonly telephone?: string;
  /** Google Maps directions to the building. */
  readonly directionsUrl: string;
}

const business: ChurchFacts = {
  address: {
    city: "Laguna Niguel",
    postalCode: "92677",
    region: "CA",
    street: "24600 La Plata Drive",
  },
  directionsUrl:
    "https://www.google.com/maps/dir/?api=1&destination=Grace+Church+24600+La+Plata+Drive+Laguna+Niguel+CA+92677",
  email: "welcome@gracechurchlagunaniguel.org",
  telephone: "+1-949-388-5537",
};

export const site = {
  business,

  description:
    "An independent Reformed church in Laguna Niguel, California. Join us Sundays for worship at 10:00 am and 6:00 pm, with Sunday school at 9:00 am.",

  /** Appended to meta descriptions too short for a search snippet (see `metaDescription`). */
  descriptionContext:
    "Grace Church is a Reformed church in Laguna Niguel, California.",

  /**
   * Attached as a custom domain on the `prod` stage only. Unset until the zone is
   * on the Cloudflare account (attaching an unowned domain fails the deploy), so
   * only staging deploys until configured. Intended domain: gracechurchlagunaniguel.org.
   */
  domain: null,

  /** Online giving (the church's Cornerstone page). */
  givingUrl: "https://give.cornerstone.cc/gracechurchlagunaniguel",

  /** Prefixes Worker names (`gracechurchlagunaniguel-<stage>`) and the Alchemy stack. */
  id: "gracechurchlagunaniguel",

  // The church's notification addresses (prod only), filled in when confirmed.
  leadInbox: [],

  /** The church's YouTube channel: services stream here and sermons are posted here. */
  liveChannelId: "UCKtTqhvGrbHYp_YlqbWuW0Q",

  /**
   * Public base URL EmDash downloads seed images from when the stage cannot
   * serve them itself (local workerd: EmDash's SSRF guard refuses localhost).
   * Deployed stages use their own `/_seed/media`.
   */
  localSeedMediaBase:
    "https://gracechurchlagunaniguel-staging.jbolabs.com/_seed/media",

  name: "Grace Church",

  /** Display form of `business.telephone`. */
  phone: "(949) 388-5537",

  shortName: "Grace Church",

  stagingBaseDomain: studio.domain,

  /** Events, the agenda, and calendar files use the church's local time. */
  timeZone: "America/Los_Angeles",

  /** The Cloudflare account's workers.dev subdomain for developer previews. */
  workersSubdomain: "jakebodea",
} as const;
