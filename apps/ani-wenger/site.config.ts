import { studio } from "../../stacks/config.ts";

/**
 * Everything that makes this site *this* site (as opposed to the template):
 * identity, domain, business facts for structured data, and contact routing.
 * Copy is NOT here: editors own it in EmDash (see seed/seed.json). Structurally
 * a `SiteIdentity` (checked where alchemy.run.ts passes it to `resolveStage`).
 */
/** Facts for the HairSalon JSON-LD and the footer. Leave unknown fields out rather than guessing. */
interface BusinessFacts {
  /** Where clients come from; the salon is in Irvine, near John Wayne Airport. */
  readonly areaServed: readonly string[];
  readonly email: string;
  readonly instagram: string;
  /** The salon Ani works from, as printed on her business card. */
  readonly salon: {
    readonly name: string;
    readonly locality: string;
    readonly region: string;
    readonly street: string;
    readonly postalCode: string;
  };
  /** E.164 form for `tel:` links and JSON-LD. */
  readonly telephone: string;
}

const business: BusinessFacts = {
  areaServed: [
    "Irvine, CA",
    "Newport Beach, CA",
    "Costa Mesa, CA",
    "Tustin, CA",
    "Laguna Niguel, CA",
    "Orange County, CA",
  ],
  email: "aniwenger@gmail.com",
  instagram: "https://www.instagram.com/aniwenger/",
  salon: {
    locality: "Irvine",
    name: "James Matthew Salon",
    postalCode: "92612",
    region: "CA",
    street: "19800 MacArthur Blvd., Ste. C80",
  },
  telephone: "+19492756251",
};

export const site = {
  business,

  description:
    "Ani Wenger is a European master hairstylist in Irvine: precision cuts, color, gray blending, and care for thinning hair. Book online.",

  /** Appended to meta descriptions too short for a search snippet (see `metaDescription`). */
  descriptionContext:
    "Ani Wenger, European master hairstylist at James Matthew Salon in Irvine, California.",

  /**
   * Attached as a custom domain on the `prod` stage only. Unset until the zone is
   * on the Cloudflare account (attaching an unowned domain fails the deploy), so
   * only staging deploys until then. aniwenger.com lapsed and was
   * re-registered by a domain reseller on 2025-10-29; it is not Ani's today.
   */
  domain: null,

  /** Prefixes Worker names (`ani-wenger-<stage>`) and the Alchemy stack. */
  id: "ani-wenger",

  // Ani's notification address for new bookings and messages, set once she confirms it.
  leadInbox: null,

  /**
   * Public base URL EmDash downloads seed images from when the stage cannot
   * serve them itself (local workerd: EmDash's SSRF guard refuses localhost).
   * Deployed stages use their own `/_seed/media`. Staging is the site's
   * persistent deployment until it has a production domain.
   */
  localSeedMediaBase: "https://ani-wenger-staging.jbolabs.com/_seed/media",

  name: "Ani Wenger",

  /** Display form of `business.telephone`. */
  phone: "949-275-6251",

  shortName: "Ani Wenger",

  stagingBaseDomain: studio.domain,

  /** IANA zone the salon keeps its hours in; every booking time is wall-clock here. */
  timeZone: "America/Los_Angeles",

  /** The Cloudflare account's workers.dev subdomain for developer previews. */
  workersSubdomain: "jakebodea",
} as const;
