/**
 * Paid-ad landing pages, served at `/lp/<slug>` by `src/pages/lp/[slug].astro`.
 * Each is one screen: the ad's headline, a line of benefit, three points and
 * the application right on the page. They live in code, not the CMS, so they
 * stay out of the admin, the menus and the sitemap; the route marks them
 * noindex.
 *
 * Every line comes from the compliance-approved Meta creative for the page or
 * from the main site's own copy. The footer shows the main site's
 * disclosures, which explain the asterisks; a page whose ad carries its own
 * asterisk line keeps that line word for word in `note`. The renovation
 * page shows the main site's calculator, read from the CMS.
 */

export interface LandingPage {
  readonly title: string;
  /** The meta description. */
  readonly intro: string;
  readonly headline: string;
  readonly headlineAccent: string;
  readonly benefit: string;
  readonly points: readonly string[];
  /** The ad's own asterisk line, word for word, where the site's disclosures don't cover it. */
  readonly note?: string;
  /** Show the main site's renovation planner below the application. */
  readonly planner?: boolean;
}

export const LANDING_PAGES = {
  "debt-consolidation": {
    benefit:
      "A HELOC could help consolidate eligible high-interest debts into a single credit line.*",
    headline: "Consolidate with",
    headlineAccent: "one home equity line.",
    intro:
      "Roll eligible high-interest balances into one home equity line, and check your options with a soft credit check.",
    note: "*Using a HELOC to consolidate unsecured debt makes that debt secured by your home. Failure to repay could result in foreclosure. Total borrowing costs may vary.",
    points: [
      "Soft credit check only: starting won't affect your score.",
      "HELOCs from $5,000 to $1,000,000",
      "Funding in as few as 5 days*",
    ],
    title: "Consolidate Debt With a HELOC",
  },
  "digital-heloc": {
    benefit:
      "Digitally verified income,* a soft credit check* to see your options, plus e-sign from home. No branch visits, no sales calls.",
    headline: "Funding in as few as",
    headlineAccent: "5 business days.*",
    intro:
      "Approval in as little as 30 minutes and funding in as few as 5 business days, with digitally verified income and e-sign from home.",
    note: "*Initial options check only. A full application requires a hard credit inquiry. Additional documents may be required to verify income.",
    points: [
      "Approvals in as little as 30 minutes*",
      "Digitally verified income*",
      "E-sign from home",
    ],
    title: "A Digital HELOC With Less Paperwork",
  },
  "home-renovation": {
    benefit: "Big plans for your home? Put your equity in motion.",
    headline: "The kitchen won't",
    headlineAccent: "remodel itself.",
    intro:
      "Put your home equity toward the kitchen, the bath, or the next project on your list, and see which projects pay you back.",
    planner: true,
    points: [
      "Draw only what you need",
      "Interest only on what you draw",
      "No appraisal on eligible loans under $400K*",
    ],
    title: "Fund Your Home Renovation With a HELOC",
  },
  "keep-your-rate": {
    benefit: "Your Equity. Your Terms.",
    headline: "Love your mortgage rate?",
    headlineAccent: "Keep it.*",
    intro:
      "Use your equity with a second-lien HELOC while your existing first mortgage may remain in place.",
    note: "*Existing first mortgage may remain in place. Second-lien HELOC eligibility and approval requirements apply.",
    points: [
      "1st lien · Current mortgage",
      "2nd lien · Home equity line",
      "Interest only on what you draw",
    ],
    title: "Keep Your Mortgage Rate With a Second-Lien HELOC",
  },
} satisfies Record<string, LandingPage>;

export type LandingPageSlug = keyof typeof LANDING_PAGES;

const isSlug = (slug: string): slug is LandingPageSlug =>
  Object.hasOwn(LANDING_PAGES, slug);

/** The landing page at `/lp/<slug>`, or undefined for any other slug. */
export const landingPage = (slug?: string): LandingPage | undefined =>
  slug !== undefined && isSlug(slug) ? LANDING_PAGES[slug] : undefined;

/** The main site's CMS page whose renovation planner the renovation page shows. */
export const PLANNER_SOURCE_SLUG = "calculator";
