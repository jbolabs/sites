import type { PageContentBlock } from "../../emdash-env";
/**
 * Paid-ad landing pages, served at `/lp/<slug>` by `src/pages/lp/[slug].astro`.
 * They live in code, not the CMS: they are temporary campaign pages, so
 * merging the PR ships them to every stage (production included) without
 * editing production content, and they stay out of the admin, the menus and
 * the sitemap. The route marks them noindex.
 *
 * Their sections are the CMS page blocks, so `PageBlocks` renders them and
 * every apply button opens the in-page application, which records
 * `/lp/<slug>` as the lead's page.
 */
import placeholders from "../../seed/placeholders.json" with { type: "json" };
import type { MediaImage } from "./content.ts";

type SeedFile = keyof typeof placeholders;

/**
 * A photo from `seed/media`, which every stage serves at `/_seed/media/`.
 * Its blurred placeholder comes straight from `seed/placeholders.json`
 * (the kit's lookup only knows photos the CMS seed references).
 */
const seedPhoto = (file: SeedFile, alt: string): MediaImage => ({
  alt,
  blurhash: placeholders[file].blurhash,
  dominantColor: placeholders[file].dominantColor,
  filename: file,
  id: file,
  src: `/_seed/media/${file}`,
});

/** Copy several pages share. */
const SOFT_CHECK = "Soft credit check only: starting won't affect your score.";
const LINE_AMOUNTS = "Line amounts";
const SECOND_LIEN = "Second-lien HELOC";

export interface LandingPage {
  readonly title: string;
  /** The meta description. */
  readonly intro: string;
  readonly content: PageContentBlock[];
}

export const LANDING_PAGES = {
  "debt-consolidation": {
    content: [
      {
        _key: "hero",
        _type: "page_hero",
        _version: 1,
        apply_label: "Check Your Options",
        headline: "Consolidate with",
        headline_accent: "one home equity line.",
        image: seedPhoto(
          "info-hero-Clqmc_9J.jpg",
          "A single-story home under tall trees"
        ),
        intro:
          "A HELOC could help consolidate eligible high-interest debts into a single credit line.*",
      },
      {
        _key: "how",
        _type: "numbered_cards",
        _version: 1,
        headline: "Several balances.",
        headline_accent: "One line.",
        items: [
          {
            body: "Card balances, personal loans, and other eligible high-interest debt.",
            title: "Add up what you owe",
          },
          {
            body: "A soft credit check shows your initial options without affecting your score. A full application requires a hard credit inquiry.",
            title: "Check your options",
          },
          {
            body: "Draw on your line to pay off the balances you choose, then manage one home equity line instead of several accounts.",
            title: "Pay them off from your line",
          },
        ],
        tone: "light",
      },
      {
        _key: "guidelines",
        _type: "guidelines",
        _version: 1,
        body: "Consolidating with a HELOC moves unsecured debt onto a line secured by your home. Your final terms depend on the program, occupancy, lien position, and your borrower profile.",
        footnote:
          "*Using a HELOC to consolidate unsecured debt makes that debt secured by your home. Failure to repay could result in foreclosure. Total borrowing costs may vary. A minimum FICO® of 600 is available only on select program, lien-position, and occupancy combinations. Funding timelines are not guaranteed. Not all applicants or properties will qualify.",
        headline: "Know before",
        headline_accent: "you consolidate",
        items: [
          {
            label: LINE_AMOUNTS,
            value: "$5,000 to $1,000,000",
          },
          {
            label: "Credit score (FICO®)",
            value: "As low as 600*",
          },
          {
            label: "Lien position",
            value: "1st & 2nd",
          },
          {
            label: "Funding speed",
            value: "As few as 5 days*",
          },
        ],
      },
      {
        _key: "cta",
        _type: "cta_band",
        _version: 1,
        apply_label: "Check Your Options",
        body: SOFT_CHECK,
        headline: "See what you could consolidate.",
        layout: "centered",
      },
    ],
    intro:
      "Roll eligible high-interest balances into one home equity line, and check your options with a soft credit check.",
    title: "Consolidate Debt With a HELOC",
  },
  "digital-heloc": {
    content: [
      {
        _key: "hero",
        _type: "page_hero",
        _version: 1,
        apply_label: "Skip the Slow Lane",
        headline: "Funding in as few as",
        headline_accent: "5 business days.*",
        image: seedPhoto("process-hero-CWuZMHda.jpg", "A home at twilight"),
        intro:
          "A digital-first HELOC. Soft credit check to see your options.* No branch visits, no sales calls.",
      },
      {
        _key: "stats",
        _type: "stats",
        _version: 1,
        headline: "At a glance",
        items: [
          {
            label: "Approval in as little as*",
            value: "30 min",
          },
          {
            label: "Funding in as few as*",
            value: "5 days",
          },
          {
            label: LINE_AMOUNTS,
            value: "$5K to $1M",
          },
          {
            label: "Application",
            value: "Online",
          },
        ],
      },
      {
        _key: "paperwork",
        _type: "numbered_cards",
        _version: 1,
        apply_label: "Apply Online",
        headline: "The HELOC with",
        headline_accent: "less paperwork.",
        items: [
          {
            body: "Income is verified digitally. Additional documents may be required to verify income.",
            title: "Digitally verified income",
          },
          {
            body: "See your initial options without affecting your score. A full application requires a hard credit inquiry.",
            title: "Soft credit check",
          },
          {
            body: "Review and sign your documents online.",
            title: "E-sign from home",
          },
          {
            body: "Apply, verify, and sign without stopping by an office.",
            title: "No branch visits",
          },
        ],
        tone: "light",
      },
      {
        _key: "cta",
        _type: "cta_band",
        _version: 1,
        apply_label: "Apply Online",
        body: SOFT_CHECK,
        headline: "Skip the slow lane.",
        layout: "centered",
      },
    ],
    intro:
      "Approval in as little as 30 minutes and funding in as few as 5 business days, with digitally verified income and e-sign from home.",
    title: "A Digital HELOC With Less Paperwork",
  },
  "home-renovation": {
    content: [
      {
        _key: "hero",
        _type: "page_hero",
        _version: 1,
        apply_label: "Explore What Your Equity Can Do",
        headline: "The kitchen won't",
        headline_accent: "remodel itself.",
        image: seedPhoto(
          "calculator-hero-C9VXZbVq.jpg",
          "A renovated home exterior"
        ),
        intro: "Big plans for your home? Put your equity in motion.",
      },
      {
        _key: "how",
        _type: "numbered_cards",
        _version: 1,
        headline: "Built for projects",
        headline_accent: "that happen in stages.",
        items: [
          {
            body: "Pay the contractor as invoices come in instead of borrowing it all on day one.",
            title: "Draw as the work moves",
          },
          {
            body: "Money you haven't used yet carries no balance.",
            title: "Interest only on what you draw",
          },
          {
            body: "An appraisal may not be required on eligible loans under $400,000.*",
            title: "No full appraisal on many loans",
          },
        ],
        tone: "light",
      },
      {
        _key: "planner",
        _type: "renovation_planner",
        _version: 1,
        disclaimer:
          "Estimates only, based on national average cost-vs-value data plus 3-year appreciation. Actual results vary by market and condition.",
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
      },
      {
        _key: "cta",
        _type: "cta_band",
        _version: 1,
        apply_label: "Start Now",
        body: SOFT_CHECK,
        headline: "Ready to start the project?",
        layout: "centered",
      },
    ],
    intro:
      "Put your home equity toward the kitchen, the bath, or the next project on your list, and see which projects pay you back.",
    title: "Fund Your Home Renovation With a HELOC",
  },
  "keep-your-rate": {
    content: [
      {
        _key: "hero",
        _type: "page_hero",
        _version: 1,
        apply_label: "Explore Your Options",
        headline: "Love your mortgage rate?",
        headline_accent: "Keep it.*",
        image: seedPhoto(
          "estate-hero-X6IKSjTQ.jpg",
          "A two-story craftsman home lit up at dusk"
        ),
        intro:
          "Your equity. Your terms. A second-lien HELOC is a new line of credit that sits behind the mortgage you already have.",
      },
      {
        _key: "compare",
        _type: "comparison",
        _version: 1,
        feature_label: "Feature",
        headline: SECOND_LIEN,
        headline_accent: "vs. cash-out refinance",
        ours_label: SECOND_LIEN,
        rows: [
          {
            feature: "Your first mortgage",
            ours: "Stays in place*",
            theirs: "Replaced with a new loan",
          },
          {
            feature: "How you get funds",
            ours: "A line you draw as needed",
            theirs: "One lump sum at closing",
          },
          {
            feature: "Interest",
            ours: "Only on what you draw",
            theirs: "On the full new loan balance",
          },
        ],
        theirs_label: "Cash-out refinance",
      },
      {
        _key: "guidelines",
        _type: "guidelines",
        _version: 1,
        body: "Your final terms depend on the program, occupancy, and your borrower profile.",
        footnote:
          "*Eligible second-lien HELOC financing only. Existing first mortgage may remain in place. Second-lien HELOC eligibility and approval requirements apply.",
        headline: SECOND_LIEN,
        headline_accent: "at a glance",
        items: [
          {
            label: LINE_AMOUNTS,
            value: "$5,000 to $1,000,000",
          },
          {
            label: "Lien position",
            value: "2nd, behind your mortgage",
          },
          {
            label: "Occupancy",
            value: "Owner & non-owner",
          },
          {
            label: "Eligible property types",
            value: "SFR, condo, PUD, townhome, 2-4 unit",
          },
        ],
      },
      {
        _key: "cta",
        _type: "cta_band",
        _version: 1,
        apply_label: "Explore Your Options",
        body: SOFT_CHECK,
        headline: "Keep your rate. Use your equity.",
        layout: "centered",
      },
    ],
    intro:
      "Use your equity with a second-lien HELOC while your existing first mortgage may remain in place.",
    title: "Keep Your Mortgage Rate With a Second-Lien HELOC",
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
