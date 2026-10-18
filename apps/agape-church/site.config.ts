/**
 * Everything that makes this site *this* site (as opposed to the template):
 * identity, domain, church facts for structured data, and contact routing.
 * Copy is NOT here: editors own it in EmDash (see seed/seed.json). Structurally
 * a `SiteIdentity` (checked where alchemy.run.ts passes it to `resolveStage`).
 */
/** Facts for the Church JSON-LD and the footer. Leave unknown fields out rather than guessing. */
interface ChurchFacts {
  readonly address: {
    readonly street: string;
    readonly city: string;
    readonly region: string;
    readonly postalCode: string;
  };
  readonly email: string;
  /** Zelle, Venmo, and Cash App all send to this address (see the Give page). */
  readonly givingEmail: string;
  readonly telephone: string;
  readonly social: {
    readonly facebook: string;
    readonly youtube: string;
    readonly x: string;
  };
}

const business: ChurchFacts = {
  address: {
    city: "Yorba Linda",
    postalCode: "92886",
    region: "CA",
    street: "4572 Rose Drive",
  },
  email: "contact@agapeoc.com",
  givingEmail: "give@agapeoc.com",
  social: {
    facebook: "https://www.facebook.com/AgapeOC/",
    x: "https://x.com/agapeoc",
    youtube: "https://www.youtube.com/user/AgapeOC",
  },
  telephone: "+1-714-386-7210",
};

export const site = {
  business,

  description:
    "Agape Church is a Romanian Pentecostal church in Yorba Linda, Orange County. Sunday services at 10 AM and 6 PM, streamed live.",

  /** Appended to meta descriptions too short for a search snippet (see `metaDescription`). */
  descriptionContext:
    "Agape Church, a Romanian Pentecostal church in Yorba Linda, California.",

  /**
   * Attached as a custom domain on the `prod` stage only. Unset until the zone is
   * on the Cloudflare account (attaching an unowned domain fails the deploy), so
   * prod serves from workers.dev for now. Intended domain: agapeoc.com.
   */
  domain: null,

  /** Prefixes Worker names (`agape-church-<stage>`) and the Alchemy stack. */
  id: "agape-church",

  // The church's notification address, filled in when confirmed.
  leadInbox: null,

  /**
   * Public base URL EmDash downloads seed images from when the stage cannot
   * serve them itself (local workerd: EmDash's SSRF guard refuses localhost).
   * Deployed stages use their own `/_seed/media`. Until the first prod deploy
   * serves them, local seeds start without images.
   */
  localSeedMediaBase:
    "https://agape-church-prod.jakebodea.workers.dev/_seed/media",

  name: "Agape Church",

  shortName: "Agape Church",

  /** The Cloudflare account's workers.dev subdomain (non-prod stages live there). */
  workersSubdomain: "jakebodea",
} as const;
