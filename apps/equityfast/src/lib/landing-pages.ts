import type { PageContentBlock } from "../../emdash-env";
/**
 * Paid-ad landing pages, served at `/lp/<slug>` by `src/pages/lp/[slug].astro`.
 * Each is one screen built for an ad click: the ad's headline, a line of
 * benefit, three points and the application on the page, under a header and
 * footer without menus. The renovation page keeps its planner below.
 *
 * They live in code, not the CMS: they are temporary campaign pages, so
 * merging the PR ships them to every stage (production included) without
 * editing production content, and they stay out of the admin, the menus and
 * the sitemap. The route marks them noindex.
 *
 * Copy follows the lender's compliance review (Nov 11): footnotes are
 * numbered per page and only the ones a page's claims need are shown; speed
 * and soft-credit claims carry their qualifiers next to them. Square
 * brackets mark facts still owed by EquityFast; never fill them in by guess.
 */

export interface LandingPoint {
  readonly text: string;
  /** A qualifier shown under the point. */
  readonly detail?: string;
}

export interface LandingPage {
  /** The page title (sentence case). */
  readonly title: string;
  /** The meta description. */
  readonly intro: string;
  readonly headline: string;
  readonly headlineAccent: string;
  readonly benefit: string;
  /** A cost or rate warning shown right under the benefit. */
  readonly warning?: string;
  readonly points: readonly LandingPoint[];
  /** A qualifier shown under the points. */
  readonly qualifier?: string;
  /** The page's footnotes, in order: note 1 is the claim marked ¹. */
  readonly notes: readonly string[];
  /** Extra sections below the application (the renovation planner). */
  readonly sections?: readonly PageContentBlock[];
}

/** Next to every soft-credit claim (compliance review, Nov 11). */
export const SOFT_CHECK =
  "Checking options uses a soft credit pull. A hard inquiry occurs if you proceed with a full application.";
const LINE_AMOUNTS = "Lines from $5,000 to $1,000,000";

/** The site's own disclosures, with the lender's name as compliance requires. */
const SPEED_NOTE =
  "Approval may be granted in as little as thirty minutes but is subject to verification of income, employment, and property condition which could take longer. Funding in as few as five business days applies in eligible circumstances and may vary greatly based on loan amount, property location, closing requirements, and other factors. Funding timelines are not guaranteed.";
const SOFT_PULL_NOTE =
  "A soft credit pull is used to check initial options and does not impact your credit score. If you proceed with a full application, a hard credit inquiry will occur.";
const AMOUNT_NOTE =
  "Actual loan amounts will vary based on your home value and equity at the time of application, as determined by EquityFast dba E Mortgage Capital using independent data sources and automated valuation models. Borrowers must maintain at least 10% of the line of credit unused for a minimum of 16 weeks.";
const APPRAISAL_NOTE =
  "For eligible loans under $400,000, a traditional appraisal may not be required.";

/** The renovation planner's figures need a named source (owed by EquityFast). */
const ROI_SOURCE =
  "Source: [Cost vs. Value report and year, from EquityFast]. Appreciation assumed at [rate, from EquityFast]%/yr. Past results don't predict future value. A HELOC does not increase your home's value.";

const PLANNER: PageContentBlock = {
  _key: "planner",
  _type: "renovation_planner",
  _version: 1,
  disclaimer: `Estimates only, based on national average cost-vs-value data plus 3-year appreciation. Actual results vary by market and condition. ${ROI_SOURCE}`,
  headline: "Which projects actually",
  headline_accent: "pay you back?",
  intro:
    "Tap the projects you're considering. We preload a typical budget; slide to match yours and watch the estimated equity gain update. Figures use national average ROI plus three years of home appreciation.",
  projects: [
    {
      blurb: "Highest return per dollar in the set.",
      name: "Garage Door Replacement",
      roi_percent: 327,
      typical_budget: 4500,
    },
    {
      blurb: "Small spend, outsized curb appeal.",
      name: "Steel Entry Door",
      roi_percent: 264,
      typical_budget: 2400,
    },
    {
      blurb: "Facade upgrade with strong resale lift.",
      name: "Exterior Stonework",
      roi_percent: 254,
      typical_budget: 11_000,
    },
    {
      blurb: "Cheapest way to modernize interiors.",
      name: "Hardwood Floor Refinish",
      roi_percent: 180,
      typical_budget: 5000,
    },
    {
      blurb: "Cabinet fronts, counters, appliances.",
      name: "Minor Kitchen Remodel",
      roi_percent: 138,
      typical_budget: 27_000,
    },
    {
      blurb: "Full refresh of a primary bath.",
      name: "Bathroom Remodel",
      roi_percent: 120,
      typical_budget: 25_000,
    },
    {
      blurb: "Value plus resilience in storm markets.",
      name: "Backup Power Generator",
      roi_percent: 116,
      typical_budget: 15_000,
    },
    {
      blurb: "Adds usable square footage outdoors.",
      name: "Deck / Outdoor Living",
      roi_percent: 115,
      typical_budget: 18_000,
    },
    {
      blurb: "New roof protects the home and reassures buyers.",
      name: "Roof",
      roi_percent: 109,
      typical_budget: 30_000,
    },
    {
      blurb: "Efficiency gains plus resale credit.",
      name: "Window Replacement",
      roi_percent: 106,
      typical_budget: 22_000,
    },
  ],
};

export const LANDING_PAGES = {
  "debt-consolidation": {
    benefit:
      "A HELOC could help consolidate eligible high-interest debts into a single credit line.¹",
    headline: "Consolidate with",
    headlineAccent: "one home equity line.",
    intro:
      "Roll eligible high-interest balances into one home equity line. Checking your options uses a soft credit pull.",
    notes: [
      "Consolidating debt with a HELOC may increase the total interest you pay over time, even if your monthly payment is lower, and it secures that debt with your home. Failure to repay could result in foreclosure. Total borrowing costs may vary. A minimum FICO® of 600 is available only on select program, lien-position, and occupancy combinations.",
      SPEED_NOTE,
      AMOUNT_NOTE,
    ],
    points: [
      { text: SOFT_CHECK },
      { text: `${LINE_AMOUNTS}³` },
      { text: "Funding in as few as 5 business days²" },
    ],
    title: "Consolidate debt with a HELOC",
    warning:
      "Total interest may rise over time: a lower monthly payment can still mean a higher total cost.",
  },
  "digital-heloc": {
    benefit:
      "A digital-first HELOC. Soft credit check to see your options.² No branch visits.",
    headline: "Funding in as few as",
    headlineAccent: "5 business days.¹",
    intro:
      "A digital HELOC with digitally verified income and e-sign from home. Approval and funding times are subject to verification and not guaranteed.",
    notes: [SPEED_NOTE, SOFT_PULL_NOTE],
    points: [
      { text: "Approval in as little as 30 minutes¹" },
      {
        detail: "Additional documents may be required to verify income.",
        text: "Income is verified digitally",
      },
      { text: "Review and sign your documents online" },
    ],
    qualifier:
      "Approval in as little as 30 minutes subject to verification; funding in as few as 5 business days in eligible cases. Not guaranteed.",
    title: "A digital HELOC with less paperwork",
  },
  "home-renovation": {
    benefit: "Use a HELOC to fund your project, draw as you go.",
    headline: "The kitchen won't",
    headlineAccent: "remodel itself.",
    intro:
      "Put your home equity toward the kitchen, the bath, or the next project on your list, and see which projects pay you back.",
    notes: [`${APPRAISAL_NOTE} ${AMOUNT_NOTE}`],
    points: [
      {
        detail:
          "Borrowers must keep at least 10% of the line unused for a minimum of 16 weeks.",
        text: "Draw as the work moves",
      },
      {
        detail: "Interest accrues on the drawn balance; the rate is variable.",
        text: "Interest only on what you draw",
      },
      {
        detail:
          "An appraisal may not be required on eligible loans under $400,000.",
        text: "No traditional appraisal on eligible loans¹",
      },
    ],
    sections: [PLANNER],
    title: "Fund your home renovation with a HELOC",
  },
  "keep-your-rate": {
    benefit:
      "A second-lien HELOC is a new line of credit that sits behind the mortgage you already have.",
    headline: "Love your mortgage rate?",
    headlineAccent: "Keep it.¹",
    intro:
      "Use your equity with a second-lien HELOC while your existing first mortgage may remain in place. The HELOC has its own variable rate.",
    notes: [
      "Eligible second-lien HELOC financing only. Existing first mortgage may remain in place. Second-lien HELOC eligibility and approval requirements apply.",
      AMOUNT_NOTE,
    ],
    points: [
      { text: "Your first mortgage stays in place¹" },
      {
        detail: "Interest accrues on the drawn balance at a variable rate.",
        text: "Draw as needed",
      },
      { text: `${LINE_AMOUNTS}²` },
    ],
    title: "Keep your mortgage rate with a second-lien HELOC",
    warning:
      "Your first-mortgage rate stays the same. A HELOC has its own variable rate.",
  },
} satisfies Record<string, LandingPage>;

export type LandingPageSlug = keyof typeof LANDING_PAGES;

const isLandingPageSlug = (slug: string): slug is LandingPageSlug =>
  Object.hasOwn(LANDING_PAGES, slug);

/** The landing page at `/lp/<slug>`, or undefined for any other slug. */
export const landingPage = (slug?: string): LandingPage | undefined =>
  slug !== undefined && isLandingPageSlug(slug)
    ? LANDING_PAGES[slug]
    : undefined;
