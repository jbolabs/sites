import { SOCIAL_IMAGE_MIN } from "@jakebodea/cloudflare-kit/social-image";

/**
 * Technical SEO audit of a running stage: crawls every sitemap page plus
 * every internal link and checks what a search engine (and an answer engine)
 * sees in the server-rendered HTML. Each finding names the rule it breaks.
 * The checklist and the manual items (Search Console, backlinks, copy) live
 * in `.agents/skills/seo/SKILL.md`.
 */
import { request } from "./http.ts";
import { imageSize } from "./image-size.ts";
import type { ImageSize } from "./image-size.ts";
import { discoverPaths } from "./sitemap.ts";

export type Severity = "error" | "warning";

export interface SeoFinding {
  readonly rule: string;
  readonly severity: Severity;
  readonly path: string;
  readonly detail: string;
}

export interface SeoOptions {
  readonly origin: string;
  /**
   * Production must be indexable; every other stage must not be. Callers say which stage they
   * audit: hostnames cannot tell (staging and previews also use branded custom domains).
   */
  readonly production: boolean;
  /** Local CI checks page content; deployed audits also check stage policy and timing. */
  readonly checks?: "content" | "all";
}

interface PageFacts {
  readonly path: string;
  readonly status: number;
  readonly ttfbMs: number;
  readonly title: string;
  readonly description?: string | undefined;
  readonly canonical?: string | undefined;
  /** Page-level policy from `<meta name="robots">`. */
  readonly robots: string;
  /** Stage-level policy from the `X-Robots-Tag` header (non-prod stages send noindex). */
  readonly robotsHeader: string;
  readonly h1Count: number;
  readonly links: readonly string[];
  readonly images: readonly ImageFacts[];
  readonly jsonLdTypes: readonly string[];
  readonly invalidJsonLd: number;
  /** What a link preview (Open Graph / X card) shows for this page. */
  readonly social: SocialFacts;
  /** `<link rel>` → href for `icon` and `apple-touch-icon`. */
  readonly icons: Readonly<Record<string, string>>;
}

interface SocialFacts {
  readonly image?: string | undefined;
  readonly title?: string | undefined;
  readonly card?: string | undefined;
}

interface ImageFacts {
  readonly src: string;
  /** null when the attribute is missing; "" marks a decorative image. */
  readonly alt: string | null;
  readonly sized: boolean;
}

const CRAWL_CONCURRENCY = 6;
const DESCRIPTION_MIN = 50;
const DESCRIPTION_MAX = 160;
const TITLE_MAX = 60;
const TTFB_BUDGET_MS = 800;
const MAX_REDIRECTS = 5;
/** Pages this deep should carry a BreadcrumbList (e.g. /projects/<slug>). */
const BREADCRUMB_DEPTH = 2;
const MODERN_IMAGE =
  /(?:\.(?:webp|avif|svg)(?:\?|$))|(?:[?&]f=(?:webp|avif)\b)/u;
const OPTIMIZED_ENDPOINT = /\/_image\?/u;
const ICON_RELS = new Set(["icon", "apple-touch-icon"]);
const APPLE_TOUCH_SIZE = 180;
/** Open Graph / X large-card sizes: below the minimum, previews fall back to a thumbnail. */
const SOCIAL_SIZE = { height: 630, width: 1200 };
const SOCIAL_MAX_BYTES = 5_000_000;
/** WhatsApp drops previews above roughly this size. */
const SOCIAL_LIGHT_BYTES = 600_000;
const SOCIAL_RULE = "social-image";
const ABSOLUTE_URL = /^https?:\/\//u;
const TYPE_FIELD = /"@type"\s*:\s*"(?<type>[A-Za-z]+)"/gu;

const ENTITY =
  /&(?:#(?<decimal>\d+)|#x(?<hex>[\da-f]+)|(?<name>amp|quot|apos|lt|gt));/giu;
const NAMED = new Map([
  ["amp", "&"],
  ["apos", "'"],
  ["gt", ">"],
  ["lt", "<"],
  ["quot", '"'],
]);

const MAX_CODE_POINT = 0x10_ff_ff;

const decodeEntity = (match: RegExpExecArray): string => {
  const { decimal, hex, name } = match.groups ?? {};
  const code =
    decimal === undefined ? Number.parseInt(hex ?? "", 16) : Number(decimal);
  if (Number.isInteger(code) && code <= MAX_CODE_POINT) {
    return String.fromCodePoint(code);
  }
  return NAMED.get(name?.toLowerCase() ?? "") ?? match[0];
};

/** HTMLRewriter hands attribute values over raw; `&amp;` in a URL must read as `&`. */
export const decodeEntities = (value: string): string => {
  let decoded = "";
  let consumed = 0;
  for (const match of value.matchAll(ENTITY)) {
    decoded += value.slice(consumed, match.index) + decodeEntity(match);
    consumed = match.index + match[0].length;
  }
  return decoded + value.slice(consumed);
};

const attribute = (
  element: { getAttribute: (name: string) => string | null },
  name: string
): string => decodeEntities(element.getAttribute(name) ?? "");

const isNoindex = (page: PageFacts): boolean => page.robots.includes("noindex");

const isJson = (text: string): boolean => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

/** Reads the SEO-relevant parts of one page with Bun's streaming HTMLRewriter. */
const parsePage = async (
  response: Response,
  path: string,
  ttfbMs: number
): Promise<PageFacts> => {
  let title = "";
  let description: string | undefined;
  let canonical: string | undefined;
  let robots = "";
  let h1Count = 0;
  let inTitle = false;
  let jsonLd = "";
  const jsonLdBlocks: string[] = [];
  const links: string[] = [];
  const images: ImageFacts[] = [];
  let socialImage: string | undefined;
  let socialTitle: string | undefined;
  let socialCard: string | undefined;
  const icons: Record<string, string> = {};
  const rewriter = new HTMLRewriter()
    .on("head title", {
      element: () => {
        inTitle = true;
      },
      text: (chunk) => {
        if (inTitle) {
          title += chunk.text;
        }
        if (chunk.lastInTextNode) {
          inTitle = false;
        }
      },
    })
    .on('meta[name="description"]', {
      element: (element) => {
        description = element.getAttribute("content") ?? "";
      },
    })
    .on('meta[name="robots"]', {
      element: (element) => {
        robots = element.getAttribute("content") ?? "";
      },
    })
    .on('link[rel="canonical"]', {
      element: (element) => {
        canonical = attribute(element, "href");
      },
    })
    .on('meta[property="og:image"]', {
      element: (element) => {
        socialImage = attribute(element, "content");
      },
    })
    .on('meta[property="og:title"]', {
      element: (element) => {
        socialTitle = attribute(element, "content");
      },
    })
    .on('meta[name="twitter:card"]', {
      element: (element) => {
        socialCard = attribute(element, "content");
      },
    })
    .on("link[rel][href]", {
      element: (element) => {
        const rel = element.getAttribute("rel") ?? "";
        for (const token of rel.toLowerCase().split(/\s+/u)) {
          if (ICON_RELS.has(token) && icons[token] === undefined) {
            icons[token] = attribute(element, "href");
          }
        }
      },
    })
    .on("h1", {
      element: () => {
        h1Count += 1;
      },
    })
    .on("a[href]", {
      element: (element) => {
        links.push(attribute(element, "href"));
      },
    })
    .on("img", {
      element: (element) => {
        images.push({
          // A bare `alt` (decorative image) reads as null; only a missing attribute is an error.
          alt: element.hasAttribute("alt")
            ? (element.getAttribute("alt") ?? "")
            : null,
          sized:
            element.hasAttribute("width") && element.hasAttribute("height"),
          src: attribute(element, "src"),
        });
      },
    })
    .on('script[type="application/ld+json"]', {
      element: (element) => {
        jsonLd = "";
        element.onEndTag(() => {
          jsonLdBlocks.push(jsonLd);
        });
      },
      text: (chunk) => {
        jsonLd += chunk.text;
      },
    });
  await rewriter.transform(response).text();
  const valid = jsonLdBlocks.filter((block) => isJson(block));
  return {
    canonical,
    description,
    h1Count,
    icons,
    images,
    invalidJsonLd: jsonLdBlocks.length - valid.length,
    jsonLdTypes: valid.flatMap((block) =>
      [...block.matchAll(TYPE_FIELD)].flatMap((match) =>
        match.groups?.type === undefined ? [] : [match.groups.type]
      )
    ),
    links,
    path,
    robots,
    robotsHeader: response.headers.get("x-robots-tag") ?? "",
    social: { card: socialCard, image: socialImage, title: socialTitle },
    status: response.status,
    title: title.trim(),
    ttfbMs,
  };
};

/** Same-origin paths only, without query or hash; external and mailto links are out of scope. */
export const internalPath = (
  href: string,
  origin: string
): string | undefined => {
  if (!URL.canParse(href, origin)) {
    return undefined;
  }
  const url = new URL(href, origin);
  return url.origin === origin && url.protocol.startsWith("http")
    ? url.pathname
    : undefined;
};

const isCrawlable = (path: string): boolean =>
  !path.startsWith("/_emdash") &&
  !path.startsWith("/_image") &&
  !path.startsWith("/_astro") &&
  !path.startsWith("/_actions");

/** Status recorded for a page that did not finish within the request timeout. */
const NO_RESPONSE = 0;

const fetchPage = async (origin: string, path: string): Promise<PageFacts> => {
  const started = performance.now();
  try {
    const response = await request(`${origin}${path}`, { redirect: "manual" });
    return await parsePage(
      response,
      path,
      Math.round(performance.now() - started)
    );
  } catch {
    return {
      h1Count: 0,
      icons: {},
      images: [],
      invalidJsonLd: 0,
      jsonLdTypes: [],
      links: [],
      path,
      robots: "",
      robotsHeader: "",
      social: {},
      status: NO_RESPONSE,
      title: "",
      ttfbMs: Math.round(performance.now() - started),
    };
  }
};

/** Hops from `path` to a non-redirect response (0 when it serves directly). */
const redirectHops = async (origin: string, path: string): Promise<number> => {
  let url = `${origin}${path}`;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await request(url, { method: "HEAD", redirect: "manual" });
    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || location === null) {
      return hop;
    }
    url = new URL(location, url).href;
  }
  return MAX_REDIRECTS + 1;
};

const crawl = async (
  origin: string,
  seeds: readonly string[]
): Promise<Map<string, PageFacts>> => {
  const pages = new Map<string, PageFacts>();
  // Every path ever queued, so each page is fetched once.
  const seen = new Set(seeds);
  let queue = [...seen];
  while (queue.length > 0) {
    const batch = queue.slice(0, CRAWL_CONCURRENCY);
    queue = queue.slice(CRAWL_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (path) => await fetchPage(origin, path))
    );
    for (const page of results) {
      pages.set(page.path, page);
      for (const href of page.links) {
        const path = internalPath(href, origin);
        if (path !== undefined && isCrawlable(path) && !seen.has(path)) {
          seen.add(path);
          queue.push(path);
        }
      }
    }
  }
  return pages;
};

const finding = (
  rule: string,
  severity: Severity,
  path: string,
  detail: string
): SeoFinding => ({
  detail,
  path,
  rule,
  severity,
});

type Check = (page: PageFacts, options: SeoOptions) => SeoFinding[];

const at =
  (page: PageFacts) =>
  (rule: string, severity: Severity, detail: string): SeoFinding =>
    finding(rule, severity, page.path, detail);

const headChecks: Check = (page) => {
  const add = at(page);
  const found: SeoFinding[] = [];
  if (page.title === "") {
    found.push(add("title", "error", "missing <title>"));
  } else if (page.title.length > TITLE_MAX) {
    found.push(
      add(
        "title",
        "warning",
        `${page.title.length} chars (keep under ${TITLE_MAX})`
      )
    );
  }
  const length = page.description?.length ?? 0;
  if (length === 0) {
    found.push(add("meta-description", "error", "missing meta description"));
  } else if (length < DESCRIPTION_MIN || length > DESCRIPTION_MAX) {
    found.push(
      add(
        "meta-description",
        "warning",
        `${length} chars (aim for ${DESCRIPTION_MIN}-${DESCRIPTION_MAX})`
      )
    );
  }
  if (page.canonical === undefined || !page.canonical.startsWith("http")) {
    found.push(add("canonical", "error", "missing or relative canonical"));
  } else if (new URL(page.canonical).pathname !== page.path) {
    found.push(
      add(
        "canonical",
        "warning",
        `canonical points elsewhere: ${page.canonical}`
      )
    );
  }
  return found;
};

const indexingChecks: Check = (page, options) => {
  if (options.checks === "content") {
    return [];
  }
  const add = at(page);
  const stageNoindex = page.robotsHeader.includes("noindex");
  if (options.production && stageNoindex) {
    return [
      add(
        "indexable",
        "error",
        `production sends X-Robots-Tag: ${page.robotsHeader} (auditing another stage? drop --production)`
      ),
    ];
  }
  if (!options.production && !stageNoindex && !isNoindex(page)) {
    return [
      add(
        "preview-noindex",
        "error",
        "non-production stage is indexable; send X-Robots-Tag: noindex (auditing production? pass --production)"
      ),
    ];
  }
  return [];
};

const structureChecks: Check = (page, options) => {
  const add = at(page);
  const found: SeoFinding[] = [];
  if (page.h1Count !== 1) {
    found.push(
      add(
        "one-h1",
        page.h1Count === 0 ? "error" : "warning",
        `${page.h1Count} <h1> elements`
      )
    );
  }
  if (page.invalidJsonLd > 0) {
    found.push(
      add(
        "structured-data",
        "error",
        `${page.invalidJsonLd} invalid JSON-LD block(s)`
      )
    );
  }
  const depth = page.path.split("/").filter((part) => part !== "").length;
  if (
    depth >= BREADCRUMB_DEPTH &&
    !page.jsonLdTypes.includes("BreadcrumbList")
  ) {
    found.push(
      add(
        "breadcrumbs",
        "warning",
        "deep page without BreadcrumbList structured data"
      )
    );
  }
  if (options.checks !== "content" && page.ttfbMs > TTFB_BUDGET_MS) {
    found.push(
      add(
        "fast-response",
        "warning",
        `HTML took ${page.ttfbMs} ms (budget ${TTFB_BUDGET_MS} ms)`
      )
    );
  }
  return found;
};

const imageChecks: Check = (page) => {
  const add = at(page);
  return page.images.flatMap((image) => [
    ...(image.alt === null
      ? [add("image-alt", "error", `no alt attribute: ${image.src}`)]
      : []),
    ...(image.sized
      ? []
      : [
          add(
            "no-layout-shift",
            "warning",
            `image without width/height: ${image.src}`
          ),
        ]),
    ...(MODERN_IMAGE.test(image.src) || OPTIMIZED_ENDPOINT.test(image.src)
      ? []
      : [
          add(
            "modern-images",
            "warning",
            `not WebP/AVIF or optimized: ${image.src}`
          ),
        ]),
  ]);
};

const socialChecks: Check = (page) => {
  const add = at(page);
  const { card, image, title } = page.social;
  const found: SeoFinding[] = [];
  if (image === undefined || image === "") {
    found.push(add(SOCIAL_RULE, "error", "missing og:image"));
  } else if (!ABSOLUTE_URL.test(image)) {
    found.push(
      add(SOCIAL_RULE, "error", `og:image must be absolute: ${image}`)
    );
  }
  if (title === undefined || title === "") {
    found.push(add(SOCIAL_RULE, "error", "missing og:title"));
  }
  if (card !== "summary_large_image") {
    found.push(
      add(
        SOCIAL_RULE,
        "error",
        `twitter:card is ${card ?? "missing"}; want summary_large_image`
      )
    );
  }
  return found;
};

/** Rules that look at one page in isolation. */
export const pageFindings = (
  page: PageFacts,
  options: SeoOptions
): SeoFinding[] => {
  const add = at(page);
  if (page.status >= 300 && page.status < 400) {
    return [
      add(
        "no-internal-redirects",
        "warning",
        `linked page answers ${page.status}; link to the final URL`
      ),
    ];
  }
  if (page.status !== 200) {
    const detail =
      page.status === NO_RESPONSE
        ? "no complete response within the request timeout"
        : `HTTP ${page.status}`;
    return [add("no-broken-links", "error", detail)];
  }
  return [
    headChecks,
    indexingChecks,
    structureChecks,
    imageChecks,
    socialChecks,
  ].flatMap((check) => check(page, options));
};

const duplicates = (
  pages: readonly PageFacts[],
  field: "title" | "description"
): SeoFinding[] => {
  const byValue = new Map<string, string[]>();
  for (const page of pages) {
    const value = page[field];
    if (value !== undefined && value !== "") {
      byValue.set(value, [...(byValue.get(value) ?? []), page.path]);
    }
  }
  return [...byValue.entries()].flatMap(([value, paths]) =>
    paths.length > 1
      ? [
          finding(
            `unique-${field}`,
            "warning",
            paths.join(", "),
            `shared ${field}: "${value.slice(0, 80)}"`
          ),
        ]
      : []
  );
};

export interface FetchedImage {
  readonly status: number;
  readonly bytes: number;
  readonly size?: ImageSize | undefined;
  /** Vector icons have no pixel size; browsers scale them. */
  readonly svg?: boolean;
}

const fetchImage = async (url: string): Promise<FetchedImage> => {
  try {
    const response = await request(url);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      bytes: bytes.byteLength,
      size: response.ok ? imageSize(bytes) : undefined,
      status: response.status,
      svg: (response.headers.get("content-type") ?? "").includes("image/svg"),
    };
  } catch {
    return { bytes: 0, status: NO_RESPONSE };
  }
};

const loadFailure = (image: FetchedImage): string | undefined => {
  if (image.status === NO_RESPONSE) {
    return "did not load";
  }
  if (image.status !== 200) {
    return `answers HTTP ${image.status}`;
  }
  return image.size === undefined
    ? "is not a PNG, JPEG, WebP or GIF"
    : undefined;
};

/** Miniflare's Images emulation returns `/_image` sources untouched, so only deployed stages resize. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Formats every link preview shows; EmDash's `/_image` names JPEG `jpeg`. */
const PREVIEW_FORMATS = new Set(["png", "jpeg"]);

/**
 * `/_image` URLs say what they will return, so local audits check the request where they
 * cannot measure the result.
 */
const transformFindings = (url: URL): string[] => {
  if (url.pathname !== "/_image") {
    return [];
  }
  const width = Number(url.searchParams.get("w") ?? "0");
  const format = url.searchParams.get("f") ?? "webp";
  return [
    ...(PREVIEW_FORMATS.has(format)
      ? []
      : [`asks /_image for ${format}; use f=jpeg (previews skip WebP/AVIF)`]),
    ...(width >= SOCIAL_SIZE.width
      ? []
      : [`asks /_image for w=${width}; use w=${SOCIAL_SIZE.width}`]),
  ];
};

const geometryFindings = (
  image: FetchedImage,
  add: (severity: Severity, detail: string) => SeoFinding
): SeoFinding[] => {
  if (image.size === undefined) {
    return [];
  }
  const { format, height, width } = image.size;
  const found: SeoFinding[] = [];
  if (!PREVIEW_FORMATS.has(format)) {
    found.push(
      add("warning", `is ${format}; some link previews show only PNG or JPEG`)
    );
  }
  if (width < SOCIAL_IMAGE_MIN.width || height < SOCIAL_IMAGE_MIN.height) {
    found.push(
      add(
        "error",
        `is ${width}x${height}; large cards need ${SOCIAL_IMAGE_MIN.width}x${SOCIAL_IMAGE_MIN.height} or more`
      )
    );
  } else if (width < SOCIAL_SIZE.width) {
    found.push(
      add("warning", `is ${width}x${height}; use ${SOCIAL_SIZE.width} wide`)
    );
  }
  if (height > width) {
    found.push(
      add(
        "warning",
        `is ${width}x${height}; previews crop portrait images to 1.91:1`
      )
    );
  }
  if (image.bytes > SOCIAL_MAX_BYTES) {
    found.push(add("error", `is ${image.bytes} bytes; keep it under 5 MB`));
  } else if (image.bytes > SOCIAL_LIGHT_BYTES) {
    found.push(
      add(
        "warning",
        `is ${image.bytes} bytes; WhatsApp skips previews over about 600 KB`
      )
    );
  }
  return found;
};

/**
 * What a link preview does with one og:image (shared by every page in `path`).
 * `measured: false` trusts an `/_image` request without measuring the bytes.
 */
export const socialImageFindings = (
  image: FetchedImage,
  url: string,
  path: string,
  measured = true
): SeoFinding[] => {
  const add = (severity: Severity, detail: string): SeoFinding =>
    finding(SOCIAL_RULE, severity, path, `og:image ${detail}: ${url}`);
  const failure = loadFailure(image);
  if (failure !== undefined) {
    return [add("error", failure)];
  }
  const parsed = URL.canParse(url) ? new URL(url) : undefined;
  const transformed = parsed?.pathname === "/_image";
  return [
    ...(parsed === undefined ? [] : transformFindings(parsed)).map((detail) =>
      add("error", detail)
    ),
    ...(measured || !transformed ? geometryFindings(image, add) : []),
  ];
};

const iconFinding = (severity: Severity, detail: string): SeoFinding =>
  finding("icons", severity, "/", detail);

export interface FetchedIcon {
  readonly url: string;
  readonly image: FetchedImage;
}

/** Browser tab and home-screen icons, read from the home page; `icon` absent means no link. */
export const iconFindings = (rel: string, icon?: FetchedIcon): SeoFinding[] => {
  if (icon === undefined) {
    return [iconFinding("error", `no <link rel="${rel}">`)];
  }
  const { image, url } = icon;
  if (image.status === 200 && image.svg === true && rel === "icon") {
    return [];
  }
  const failure = loadFailure(image);
  if (failure !== undefined || image.size === undefined) {
    return [
      iconFinding("error", `${rel} ${failure ?? "is unreadable"}: ${url}`),
    ];
  }
  const { height, width } = image.size;
  if (
    rel === "apple-touch-icon" &&
    (width !== APPLE_TOUCH_SIZE || height !== APPLE_TOUCH_SIZE)
  ) {
    return [
      iconFinding(
        "warning",
        `${rel} is ${width}x${height}; iOS wants ${APPLE_TOUCH_SIZE}x${APPLE_TOUCH_SIZE}`
      ),
    ];
  }
  return width === height
    ? []
    : [iconFinding("warning", `${rel} is ${width}x${height}; make it square`)];
};

/**
 * Where the audit fetches a page's asset. Stages render absolute URLs on their configured
 * origin, which can differ from the one being audited (a local port, a preview proxy).
 */
const assetUrl = (
  href: string,
  page: PageFacts,
  origin: string
): string | undefined => {
  if (!URL.canParse(href, `${origin}${page.path}`)) {
    return undefined;
  }
  const url = new URL(href, `${origin}${page.path}`);
  const site =
    page.canonical !== undefined && URL.canParse(page.canonical)
      ? new URL(page.canonical).origin
      : origin;
  return url.origin === site
    ? new URL(`${url.pathname}${url.search}`, origin).href
    : url.href;
};

const inBatches = async <T, R>(
  items: readonly T[],
  run: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += CRAWL_CONCURRENCY) {
    results.push(
      ...(await Promise.all(
        items.slice(start, start + CRAWL_CONCURRENCY).map(run)
      ))
    );
  }
  return results;
};

const assetFindings = async (
  served: readonly PageFacts[],
  options: SeoOptions
): Promise<SeoFinding[]> => {
  const { origin } = options;
  const byImage = new Map<string, string[]>();
  for (const page of served) {
    const { image } = page.social;
    if (image !== undefined && ABSOLUTE_URL.test(image)) {
      byImage.set(image, [...(byImage.get(image) ?? []), page.path]);
    }
  }
  const social = await inBatches([...byImage], async ([image, paths]) => {
    const page = served.find((candidate) => candidate.path === paths[0]);
    const url = page === undefined ? image : assetUrl(image, page, origin);
    return url === undefined
      ? []
      : socialImageFindings(
          await fetchImage(url),
          image,
          paths.join(", "),
          !LOCAL_HOSTS.has(new URL(origin).hostname)
        );
  });
  const home = served.find((page) => page.path === "/");
  if (home === undefined) {
    return social.flat();
  }
  const icons = await inBatches([...ICON_RELS], async (rel) => {
    const href = home.icons[rel];
    const url = href === undefined ? href : assetUrl(href, home, origin);
    if (href === undefined || url === undefined) {
      return iconFindings(rel);
    }
    return iconFindings(rel, { image: await fetchImage(url), url: href });
  });
  return [...social.flat(), ...icons.flat()];
};

const ROBOTS_RULE = "robots-txt";
const ROBOTS_PATH = "/robots.txt";

const robotsFindings = async (options: SeoOptions): Promise<SeoFinding[]> => {
  const response = await request(`${options.origin}${ROBOTS_PATH}`);
  const text = response.ok ? await response.text() : "";
  const blocksAll = /^disallow:\s*\/\s*$/imu.test(text);
  const found: SeoFinding[] = [];
  if (!response.ok) {
    found.push(
      finding(ROBOTS_RULE, "error", ROBOTS_PATH, `HTTP ${response.status}`)
    );
  }
  if (options.production && blocksAll) {
    found.push(
      finding(
        ROBOTS_RULE,
        "error",
        ROBOTS_PATH,
        "production blocks all crawlers"
      )
    );
  }
  if (!/^sitemap:\s*\S+/imu.test(text)) {
    found.push(
      finding(ROBOTS_RULE, "warning", ROBOTS_PATH, "no Sitemap: line")
    );
  }
  return found;
};

export const auditSeo = async (
  options: SeoOptions
): Promise<{ readonly pages: number; readonly findings: SeoFinding[] }> => {
  const sitemap = await discoverPaths(options.origin);
  const inSitemap = new Set(sitemap);
  const pages = await crawl(options.origin, ["/", ...sitemap]);
  const served = [...pages.values()].filter((page) => page.status === 200);
  const findings: SeoFinding[] = [
    ...(await robotsFindings(options)),
    ...[...pages.values()].flatMap((page) => pageFindings(page, options)),
    ...duplicates(served, "title"),
    ...duplicates(served, "description"),
    ...(await assetFindings(served, options)),
  ];
  if (sitemap.length === 0) {
    findings.push(
      finding("sitemap", "error", "/sitemap.xml", "no pages in the sitemap")
    );
  }
  const linked = new Set(
    served.flatMap((page) =>
      page.links.flatMap((href) => internalPath(href, options.origin) ?? [])
    )
  );
  for (const path of sitemap) {
    if (path !== "/" && !linked.has(path)) {
      findings.push(
        finding(
          "no-orphans",
          "warning",
          path,
          "in the sitemap but no page links to it"
        )
      );
    }
    const page = pages.get(path);
    if (page !== undefined && isNoindex(page)) {
      findings.push(
        finding(
          "indexable",
          "error",
          path,
          `in the sitemap but noindex (${page.robots})`
        )
      );
    }
  }
  for (const path of [...linked].filter(
    (link) => isCrawlable(link) && pages.get(link)?.status === 200
  )) {
    const page = pages.get(path);
    if (
      !inSitemap.has(path) &&
      path !== "/" &&
      page !== undefined &&
      !isNoindex(page)
    ) {
      findings.push(
        finding(
          "sitemap-complete",
          "warning",
          path,
          "linked page missing from the sitemap"
        )
      );
    }
  }
  const redirecting = [...pages.values()].filter(
    (page) => page.status >= 300 && page.status < 400
  );
  for (const page of redirecting) {
    const hops = await redirectHops(options.origin, page.path);
    if (hops > 1) {
      findings.push(
        finding(
          "no-redirect-chains",
          "error",
          page.path,
          `${hops} redirect hops`
        )
      );
    }
  }
  return { findings, pages: pages.size };
};
