/**
 * How the CMS admin looks and what it offers this client (see
 * `@jakebodea/cloudflare-kit/emdash/admin`). Colors come from `src/styles/global.css`.
 */
import { defineCmsAdmin } from "@jakebodea/cloudflare-kit/emdash/admin";

export const cms = defineCmsAdmin({
  assistant: {
    collections: ["home", "pages", "projects"],
    presets: ["polish", "seo", "alt-text"],
  },
  favicon: "/favicon.png",
  guide: [
    {
      body: "Open Projects and select New Project. Add the project name, a main photo, a short description, and more photos, then Save. Select Publish when it should appear on the site.",
      title: "Add a project",
    },
    {
      body: "Open a project and change anything, then Save and Publish. Visitors see the old version until you Publish, and earlier versions stay under Revisions.",
      title: "Edit a project",
    },
    {
      body: "Each project has a Position in portfolio. Lower numbers show first, so give a project 5 to put it at the top. Turn on Show on the home page to feature it there too.",
      title: "Change the order",
    },
    {
      body: "To hide a project but keep it, open it and select Unpublish. To remove it, select Move to Trash. You can restore it from Trash later.",
      title: "Remove a project",
    },
    {
      body: "In Instagram, tap Share on a post or reel, then Copy link. In the project, under Instagram posts or reels, select Add and paste the link. It shows on the project's page.",
      title: "Add an Instagram reel",
    },
    {
      body: "Open Home page or Pages, change the words or photos, and Save. Every save is a draft until you Publish.",
      title: "Change a page",
    },
    {
      body: "Select Assistant in the top bar and describe a change in plain words. It saves drafts for you to review.",
      title: "Ask the assistant",
    },
  ],
  logo: "/icon-512.png",
  siteName: "Stud Construction",
  theme: {
    brand: "oklch(0.19 0.004 70)",
    brandHover: "oklch(0.3 0.006 70)",
    brandOnDark: "oklch(0.7 0.1 62)",
    canvas: "oklch(0.982 0.004 80)",
  },
});
