/**
 * How the CMS admin looks and what it offers this client (see
 * `@jakebodea/cloudflare-kit/emdash/admin`). Colors come from `src/styles/global.css`.
 */
import { defineCmsAdmin } from "@jakebodea/cloudflare-kit/emdash/admin";

export const cms = defineCmsAdmin({
  assistant: {
    collections: ["home", "pages", "services", "questions", "products"],
    presets: ["polish", "seo", "alt-text"],
    skills: [
      {
        description:
          "Ani's voice for anything clients read: Ask Ani answers, service descriptions, and page copy.",
        instructions: [
          "# Ani's voice",
          "",
          '- First person, warm, and direct, the way Ani talks to a client in the chair: "I suggest", "In my experience".',
          "- Short sentences. One idea per paragraph. Practical steps over theory.",
          "- Respect clients' time and intelligence; no hype words (amazing, stunning, transform your life).",
          "- Hair loss, scalp, and health topics: give hair care advice only, never a diagnosis or a supplement claim, and suggest a doctor or dermatologist when shedding is sudden or heavy.",
          "- Prices and lengths come from Services; never invent them in copy.",
          "- Mention products only if they are in Products, and add new ones there instead of linking stores in text.",
        ].join("\n"),
        name: "ani-voice",
      },
    ],
  },
  favicon: "/favicon.png",
  guide: [
    {
      body: "Schedule, in the sidebar, lists who is coming in. Cancel there and the client gets an email inviting them to rebook; the time opens up on the website right away. To add a phone booking, open Appointments and select Add new.",
      title: "See your appointments",
    },
    {
      body: "Open Time off, select Add new, and pick the first and last day. Add From and To times to block only part of a day. Clients cannot book those times.",
      title: "Take time off",
    },
    {
      body: "Open Ask Ani, select Add new, write the question as the title and your answer below it, and pick the products and services that help. Publish when it is ready.",
      title: "Answer a question",
    },
    {
      body: "Open Products, add the name, a photo, and your shopping link. Mark it Featured to show it on the home page.",
      title: "Recommend a product",
    },
  ],
  logo: "/icon-512.png",
  siteName: "Ani Wenger",
  theme: {
    brand: "oklch(0.27 0.022 45)",
    brandHover: "oklch(0.21 0.018 45)",
    brandOnDark: "oklch(0.86 0.045 80)",
    canvas: "oklch(0.985 0.005 80)",
  },
});
