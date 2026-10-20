/**
 * How CMS option values read on the site. Plain data, shared by Astro pages and
 * the booking island. The option lists themselves live in `seed/seed.json`.
 */
export const CATEGORY_LABELS = {
  color: "Color",
  consultations: "Consultations",
  cuts: "Cuts",
  extensions: "Extensions",
  styling: "Styling",
  treatments: "Treatments",
} as const;
export type ServiceCategory = keyof typeof CATEGORY_LABELS;

/** Menu order of the categories. */
export const CATEGORY_ORDER: readonly ServiceCategory[] = [
  "cuts",
  "color",
  "styling",
  "treatments",
  "extensions",
  "consultations",
];

export const TOPIC_LABELS = {
  "color-care": "Color care",
  "curly-hair": "Curly hair",
  cuts: "Cuts",
  "everyday-care": "Everyday care",
  "gray-hair": "Gray hair",
  smoothing: "Smoothing",
  "thinning-hair": "Thinning hair",
} as const;
export type Topic = keyof typeof TOPIC_LABELS;

/** Display order of topics (Ask Ani filters, product groups). */
export const TOPIC_ORDER: readonly Topic[] = [
  "thinning-hair",
  "gray-hair",
  "color-care",
  "cuts",
  "smoothing",
  "curly-hair",
  "everyday-care",
];

/** "$120", "$180+", or "Complimentary". */
export const formatPrice = (
  price: number | null | undefined,
  from: boolean | null | undefined
): string | undefined => {
  if (price === null || price === undefined) {
    return undefined;
  }
  if (price === 0) {
    return "Complimentary";
  }
  return `$${price}${from === true ? "+" : ""}`;
};

/** "45 min", "1 hr", "2 hr 30 min". */
export const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest} min`;
  }
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
};
