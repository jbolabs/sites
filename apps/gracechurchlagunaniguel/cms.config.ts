/**
 * How the CMS admin looks and what it offers this client (see
 * `@jakebodea/cloudflare-kit/emdash/admin`). Colors come from `src/styles/global.css`.
 */
import { defineCmsAdmin } from "@jakebodea/cloudflare-kit/emdash/admin";

export const cms = defineCmsAdmin({
  assistant: {
    collections: [
      "home",
      "pages",
      "announcements",
      "sermons",
      "events",
      "ministries",
    ],
    presets: ["polish", "seo", "alt-text"],
  },
  favicon: "/favicon.png",
  guide: [
    {
      body: "Open News, select Add new, write a title, a date, and a short summary, then Publish. Turn on Pin to keep it at the top and in the bar above the header; set Hide after this date so it disappears on its own.",
      title: "Post an announcement",
    },
    {
      body: "Open Sermons, select Add new, fill in the title, date, preacher, and passage, and paste the YouTube link. Add the study questions when they are ready, then Publish.",
      title: "Add Sunday's sermon",
    },
    {
      body: "Open Events to change a time or place. Repeating events need a day and a start time like 18:30; one-time events need a date. The weekly calendar and calendar subscriptions update by themselves.",
      title: "Change an event",
    },
    {
      body: "Open Messages to read contact form messages and prayer requests. Visitors never see them.",
      title: "Read messages",
    },
  ],
  logo: "/icon-512.png",
  siteName: "Grace Church",
  theme: {
    brand: "oklch(0.34 0.07 256)",
    brandHover: "oklch(0.27 0.06 257)",
    brandOnDark: "oklch(0.72 0.02 250)",
    canvas: "oklch(0.978 0.006 85)",
  },
});
