/**
 * How the CMS admin looks and what it offers this client (see
 * `@jakebodea/cloudflare-kit/emdash/admin`). Colors come from `src/styles/global.css`.
 */
import { defineCmsAdmin } from "@jakebodea/cloudflare-kit/emdash/admin";

import { LOCALES } from "./src/i18n/locales.ts";

export const cms = defineCmsAdmin({
  assistant: {
    collections: ["home", "pages", "ministries", "announcements", "site_text"],
    locales: [...LOCALES],
    presets: ["polish", "seo", "translate", "alt-text"],
  },
  favicon: "/favicon.png",
  guide: [
    {
      body: "Open Announcements, select Add new, upload the flyer, give it a title and an end date, then Publish. It shows on the home page and hides itself after the end date.",
      title: "Post an event flyer",
    },
    {
      body: "Open Pages or Ministries, change the words or photos, and Save. Every save is a draft until you Publish, and earlier versions stay under Revisions.",
      title: "Change a page or ministry",
    },
    {
      body: "Each page has an English and a Romanian version. After changing one, open its Assistant panel and select Translate to draft the other.",
      title: "Keep both languages in step",
    },
    {
      body: "Contact form messages and prayer requests from the website appear under Messages, marked by type. Service times live in Site text.",
      title: "Read messages and prayer requests",
    },
  ],
  logo: "/icon-512.png",
  siteName: "Agape Church",
  theme: {
    brand: "oklch(0.25 0.045 258)",
    brandHover: "oklch(0.19 0.04 260)",
    brandOnDark: "oklch(0.78 0.09 50)",
    canvas: "oklch(0.985 0.008 85)",
  },
});
