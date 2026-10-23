import { describe, expect, it } from "vitest";

import {
  decodeEntities,
  iconFindings,
  internalPath,
  pageFindings,
  socialImageFindings,
} from "./seo.ts";

type Page = Parameters<typeof pageFindings>[0];

const page = (overrides: Partial<Page> = {}): Page => ({
  canonical: "https://example.com/projects/a",
  description:
    "A description long enough to sit inside the search snippet budget.",
  h1Count: 1,
  icons: {},
  images: [],
  invalidJsonLd: 0,
  jsonLdTypes: ["BreadcrumbList"],
  links: [],
  path: "/projects/a",
  robots: "",
  robotsHeader: "",
  social: {
    card: "summary_large_image",
    image: "https://example.com/og-default.png",
    title: "Project A",
  },
  status: 200,
  title: "Project A | Example",
  ttfbMs: 100,
  ...overrides,
});

const rules = (facts: Page, production = true): string[] =>
  pageFindings(facts, { origin: "https://example.com", production }).map(
    (item) => item.rule
  );

describe(pageFindings, () => {
  it("passes a well-formed production page", () => {
    expect(rules(page())).toStrictEqual([]);
  });

  it("accepts an empty alt as decorative but flags a missing one", () => {
    const images = [
      { alt: "", sized: true, src: "/a.webp" },
      { alt: null, sized: true, src: "/b.webp" },
    ];
    expect(rules(page({ images }))).toStrictEqual(["image-alt"]);
  });

  it("wants a noindex header on non-production stages", () => {
    expect(rules(page(), false)).toStrictEqual(["preview-noindex"]);
    expect(
      rules(page({ robotsHeader: "noindex, nofollow" }), false)
    ).toStrictEqual([]);
  });

  it("fails production when the stage header says noindex", () => {
    expect(rules(page({ robotsHeader: "noindex" }))).toStrictEqual([
      "indexable",
    ]);
  });

  it("checks content locally without enforcing deployed headers or timing", () => {
    expect(
      pageFindings(page({ robotsHeader: "noindex", ttfbMs: 2000 }), {
        checks: "content",
        origin: "https://example.com",
        production: true,
      })
    ).toStrictEqual([]);
    expect(
      pageFindings(page({ h1Count: 0 }), {
        checks: "content",
        origin: "http://localhost",
        production: false,
      }).map((item) => item.rule)
    ).toStrictEqual(["one-h1"]);
  });

  it("asks deep pages for breadcrumbs and one h1", () => {
    expect(rules(page({ h1Count: 2, jsonLdTypes: [] }))).toStrictEqual([
      "one-h1",
      "breadcrumbs",
    ]);
  });
});

const card = "https://example.com/og-default.png";
const png = (width: number, height: number, bytes = 50_000) => ({
  bytes,
  size: { format: "png" as const, height, width },
  status: 200,
});
const details = (findings: { detail: string; severity: string }[]) =>
  findings.map((item) => `${item.severity}: ${item.detail}`);

describe("link previews", () => {
  it("wants an absolute og:image with a large card", () => {
    const findings = pageFindings(
      page({ social: { card: "summary", image: "/_image?href=a.png" } }),
      { origin: "https://example.com", production: true }
    ).map((item) => item.detail);
    expect(findings).toStrictEqual([
      "og:image must be absolute: /_image?href=a.png",
      "missing og:title",
      "twitter:card is summary; want summary_large_image",
    ]);
  });

  it("flags a page without any og:image", () => {
    expect(
      rules(page({ social: { card: "summary", title: "A" } }))
    ).toStrictEqual(["social-image", "social-image"]);
  });

  it("accepts a 1200x630 PNG", () => {
    expect(socialImageFindings(png(1200, 630), card, "/")).toStrictEqual([]);
    expect(
      details(socialImageFindings(png(1200, 630, 700_000), card, "/"))
    ).toStrictEqual([
      `warning: og:image is 700000 bytes; WhatsApp skips previews over about 600 KB: ${card}`,
    ]);
  });

  it("fails images too small for a large card and warns on narrow or portrait ones", () => {
    expect(
      details(socialImageFindings(png(500, 300), card, "/"))
    ).toStrictEqual([
      `error: og:image is 500x300; large cards need 600x315 or more: ${card}`,
    ]);
    expect(
      details(socialImageFindings(png(800, 1000), card, "/"))
    ).toStrictEqual([
      `warning: og:image is 800x1000; use 1200 wide: ${card}`,
      `warning: og:image is 800x1000; previews crop portrait images to 1.91:1: ${card}`,
    ]);
  });

  it("fails an og:image that does not load as an image", () => {
    expect(
      details(socialImageFindings({ bytes: 0, status: 404 }, card, "/"))
    ).toStrictEqual([`error: og:image answers HTTP 404: ${card}`]);
  });

  it("checks what an /_image request asks for when the result cannot be measured", () => {
    const webp = "http://localhost:4321/_image?href=%2Fa.png&w=1080&f=webp";
    expect(
      details(socialImageFindings(png(300, 200), webp, "/a", false))
    ).toStrictEqual([
      `error: og:image asks /_image for webp; use f=jpeg (previews skip WebP/AVIF): ${webp}`,
      `error: og:image asks /_image for w=1080; use w=1200: ${webp}`,
    ]);
    const jpeg = "http://localhost:4321/_image?href=%2Fa.png&w=1200&f=jpeg";
    expect(socialImageFindings(png(300, 200), jpeg, "/a", false)).toStrictEqual(
      []
    );
    expect(
      details(socialImageFindings(png(300, 200), jpeg, "/a", true))
    ).toStrictEqual([
      `error: og:image is 300x200; large cards need 600x315 or more: ${jpeg}`,
    ]);
  });

  it("wants a favicon and a 180x180 apple-touch-icon", () => {
    expect(details(iconFindings("icon"))).toStrictEqual([
      'error: no <link rel="icon">',
    ]);
    expect(
      details(
        iconFindings("apple-touch-icon", {
          image: png(120, 120),
          url: "/apple-touch-icon.png",
        })
      )
    ).toStrictEqual([
      "warning: apple-touch-icon is 120x120; iOS wants 180x180",
    ]);
    expect(
      iconFindings("icon", { image: png(64, 64), url: "/favicon.png" })
    ).toStrictEqual([]);
    const svg = { bytes: 900, status: 200, svg: true };
    expect(
      iconFindings("icon", { image: svg, url: "/mark.svg" })
    ).toStrictEqual([]);
    expect(
      details(
        iconFindings("apple-touch-icon", { image: svg, url: "/mark.svg" })
      )
    ).toStrictEqual([
      "error: apple-touch-icon is not a PNG, JPEG, WebP or GIF: /mark.svg",
    ]);
  });

  it("decodes entities in attribute URLs", () => {
    expect(
      decodeEntities("/_image?href=a.png&amp;w=1200&#38;f=jpeg&#x27;")
    ).toBe("/_image?href=a.png&w=1200&f=jpeg'");
  });
});

describe("origins", () => {
  it("keeps same-origin paths only", () => {
    expect(internalPath("/contact?x=1#top", "https://example.com")).toBe(
      "/contact"
    );
    expect(
      internalPath("https://other.com/", "https://example.com")
    ).toBeUndefined();
    expect(internalPath("mailto:a@b.c", "https://example.com")).toBeUndefined();
  });
});
