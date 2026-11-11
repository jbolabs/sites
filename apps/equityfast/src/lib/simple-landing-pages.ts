import type { PageContentBlock } from "../../emdash-env";
/**
 * A simpler take on the paid-ad landing pages, served at `/lp/simple/<slug>`
 * by `src/pages/lp/simple/[slug].astro` for the client to compare with
 * `/lp/<slug>`. Each page is one screen: the ad's headline, a line of
 * benefit, three short points and the application itself, with no other site
 * sections or menus to wander into. The renovation page keeps its planner.
 *
 * Every line reuses the copy of the full page (`landing-pages.ts`), which
 * the lender's compliance team approved, so nothing here makes a new claim.
 */
import { LANDING_PAGES } from "./landing-pages.ts";
import type { LandingPageSlug } from "./landing-pages.ts";

export interface SimpleLandingPage {
  readonly title: string;
  /** The meta description. */
  readonly intro: string;
  readonly headline: string;
  readonly headlineAccent: string;
  readonly benefit: string;
  readonly points: readonly string[];
  /** The disclosure for the page's asterisks. */
  readonly footnote: string;
  /** Extra sections below the application (the renovation planner). */
  readonly sections?: readonly PageContentBlock[];
}

const SOFT_CHECK = "Soft credit check only: starting won't affect your score.";
const LINE_AMOUNTS = "Lines from $5,000 to $1,000,000";
const QUALIFY = "Not all applicants or properties will qualify.";

const planner = LANDING_PAGES["home-renovation"].content.filter(
  (block) => block._type === "renovation_planner"
);

export const SIMPLE_LANDING_PAGES = {
  "debt-consolidation": {
    benefit:
      "A HELOC could help consolidate eligible high-interest debts into a single credit line.*",
    footnote:
      "*Using a HELOC to consolidate unsecured debt makes that debt secured by your home. Failure to repay could result in foreclosure. Total borrowing costs may vary. A minimum FICO® of 600 is available only on select program, lien-position, and occupancy combinations. Funding timelines are not guaranteed. Not all applicants or properties will qualify.",
    headline: "Consolidate with",
    headlineAccent: "one home equity line.",
    intro: LANDING_PAGES["debt-consolidation"].intro,
    points: [SOFT_CHECK, LINE_AMOUNTS, "Funding in as few as 5 days*"],
    title: LANDING_PAGES["debt-consolidation"].title,
  },
  "digital-heloc": {
    benefit:
      "A digital-first HELOC. Soft credit check to see your options.* No branch visits, no sales calls.",
    footnote: `*Funding timelines are not guaranteed. A full application requires a hard credit inquiry. ${QUALIFY}`,
    headline: "Funding in as few as",
    headlineAccent: "5 business days.*",
    intro: LANDING_PAGES["digital-heloc"].intro,
    points: [
      "Approval in as little as 30 minutes*",
      "Income verified digitally",
      "Review and sign your documents online",
    ],
    title: LANDING_PAGES["digital-heloc"].title,
  },
  "home-renovation": {
    benefit: "Big plans for your home? Put your equity in motion.",
    footnote: `*An appraisal may not be required on eligible loans under $400,000. ${QUALIFY}`,
    headline: "The kitchen won't",
    headlineAccent: "remodel itself.",
    intro: LANDING_PAGES["home-renovation"].intro,
    points: [
      "Draw as the work moves",
      "Interest only on what you draw",
      "No full appraisal on many loans under $400,000*",
    ],
    sections: planner,
    title: LANDING_PAGES["home-renovation"].title,
  },
  "keep-your-rate": {
    benefit:
      "A second-lien HELOC is a new line of credit that sits behind the mortgage you already have.",
    footnote:
      "*Eligible second-lien HELOC financing only. Existing first mortgage may remain in place. Second-lien HELOC eligibility and approval requirements apply.",
    headline: "Love your mortgage rate?",
    headlineAccent: "Keep it.*",
    intro: LANDING_PAGES["keep-your-rate"].intro,
    points: [
      "Your first mortgage stays in place*",
      "Draw as needed, interest only on what you draw",
      LINE_AMOUNTS,
    ],
    title: LANDING_PAGES["keep-your-rate"].title,
  },
} satisfies Record<LandingPageSlug, SimpleLandingPage>;

const isSlug = (slug: string): slug is LandingPageSlug =>
  Object.hasOwn(SIMPLE_LANDING_PAGES, slug);

/** The simplified page at `/lp/simple/<slug>`, or undefined for any other slug. */
export const simpleLandingPage = (
  slug?: string
): SimpleLandingPage | undefined =>
  slug !== undefined && isSlug(slug) ? SIMPLE_LANDING_PAGES[slug] : undefined;
