/**
 * How the CMS admin looks and what it offers this client (see
 * `@jakebodea/cloudflare-kit/emdash/admin`). Colors come from `src/styles/global.css`.
 */
import { defineCmsAdmin } from "@jakebodea/cloudflare-kit/emdash/admin";

export const cms = defineCmsAdmin({
  assistant: {
    collections: ["home"],
    presets: ["polish", "seo", "alt-text"],
  },
  favicon: "/favicon.png",
  guide: [
    {
      body: "Open Home page, change the words, prices, or photos, and Save. Every save is a draft until you Publish, and earlier versions stay under Revisions.",
      title: "Change the page",
    },
    {
      body: "Text in [[double brackets]] shows highlighted on the site until it is confirmed. Replace it with the real hours, ratings, or a guest's own review.",
      title: "Fill a placeholder",
    },
  ],
  logo: "/icon-512.png",
  siteName: "BodyCentre",
  theme: {
    brand: "oklch(0.29 0.03 250)",
    brandHover: "oklch(0.23 0.022 250)",
    brandOnDark: "oklch(0.84 0.03 240)",
    canvas: "oklch(0.982 0.007 80)",
  },
});
