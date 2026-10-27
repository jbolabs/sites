import { studio } from "../../stacks/config.ts";

/**
 * Everything that makes this site *this* site (as opposed to the template):
 * identity, domain, business facts for structured data, and contact routing.
 * Copy is NOT here: editors own it in EmDash (see seed/seed.json). Structurally
 * a `SiteIdentity` (checked where alchemy.run.ts passes it to `resolveStage`).
 */
/** Facts for HomeAndConstructionBusiness JSON-LD. Leave unknown fields out rather than guessing. */
interface BusinessFacts {
  readonly address: {
    readonly street: string;
    readonly city: string;
    readonly region: string;
    readonly postalCode: string;
  };
  readonly areaServed: readonly string[];
  readonly email?: string;
  readonly fax?: string;
  /** California requires the CSLB license number wherever a contractor advertises. */
  readonly license: string;
  readonly telephone?: string;
}

const business: BusinessFacts = {
  address: {
    city: "Mission Viejo",
    postalCode: "92691",
    region: "CA",
    street: "23372 Madero Rd., Ste. K",
  },
  areaServed: ["Orange County, CA"],
  email: "office@studconstruction.net",
  fax: "714-415-5538",
  // CSLB #983217, B General Building (public CSLB record, issued 2013). Confirm with the client.
  license: "CSLB Lic. #983217",
  telephone: "+1-714-873-3473",
};

export const site = {
  business,

  /**
   * The client project portal (CoConstruct, now part of Buildertrend). Clients
   * sign in there for timelines, selections, approvals, and documents.
   */
  clientPortal: "https://coconstruct.com/app/login/Stud",

  description:
    "Design-build remodeling contractor in Orange County since 2009. Whole-home remodels, additions, kitchens, baths, commercial work, and fire and water restoration.",

  /** Appended to meta descriptions too short for a search snippet (see `metaDescription`). */
  descriptionContext:
    "Design-build remodels by Stud Construction in Mission Viejo, Orange County, California.",

  /**
   * Attached as a custom domain on the `prod` stage only. Unset until the zone is
   * on the Cloudflare account (attaching an unowned domain fails the deploy), so
   * only staging deploys until configured. Intended domain: studconstruction.net.
   */
  domain: null,

  /** Prefixes Worker names (`stud-construction-<stage>`) and the Alchemy stack. */
  id: "stud-construction",

  // The client's notification addresses (prod only), filled in when known.
  leadInbox: [],

  /**
   * Public base URL EmDash downloads seed images from when the stage cannot
   * serve them itself (local workerd: EmDash's SSRF guard refuses localhost).
   * Deployed stages use their own `/_seed/media`.
   */
  localSeedMediaBase:
    "https://stud-construction-prod.jakebodea.workers.dev/_seed/media",

  name: "Stud Construction",

  /** Display form of `business.telephone`. */
  phone: "714-873-3473",

  shortName: "Stud Construction",

  /** Profiles linked in the footer and listed as `sameAs` in structured data. */
  social: [
    { label: "Instagram", url: "https://www.instagram.com/studconstruction/" },
    {
      label: "Facebook",
      url: "https://www.facebook.com/Stud-Construction-151050042526/",
    },
    {
      label: "Houzz",
      url: "https://www.houzz.com/pro/andreidamian/studconstruction",
    },
  ],

  stagingBaseDomain: studio.domain,

  /** The Cloudflare account's workers.dev subdomain for developer previews. */
  workersSubdomain: "jakebodea",
} as const;
