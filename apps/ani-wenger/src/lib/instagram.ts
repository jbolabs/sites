/**
 * Instagram reels and posts shown in the Videos section. Ani pastes whatever
 * Instagram's Share button gives her (often with a tracking query); this reads
 * it and returns the clean link and Instagram's own embed page, or `undefined`
 * for anything that is not a reel or post. Same rules as Stud Construction's
 * project links, without story highlights, which have no embed.
 */
export interface InstagramMedia {
  readonly kind: "post" | "reel";
  /** The media's shortcode, e.g. `C9xYz12AbCd`. */
  readonly code: string;
  /** Instagram's embed page, loaded in an iframe. */
  readonly embedUrl: string;
  readonly url: string;
}

const HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "m.instagram.com",
]);
const CODE = /^[\w-]{5,40}$/u;
const BASE = "https://www.instagram.com";

/** The kind of media a path segment names; `tv` is the old IGTV path for what are now reels. */
const MEDIA_KINDS = new Map<string, "post" | "reel">([
  ["p", "post"],
  ["reel", "reel"],
  ["reels", "reel"],
  ["tv", "reel"],
]);

export const instagramMedia = (raw: string): InstagramMedia | undefined => {
  const text = raw.trim();
  if (!URL.canParse(text)) {
    return undefined;
  }
  const url = new URL(text);
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    !HOSTS.has(url.hostname.toLowerCase())
  ) {
    return undefined;
  }
  const parts = url.pathname.split("/").filter((part) => part !== "");
  // Share links come as /reel/<code>/ or, newer, /<username>/reel/<code>/.
  const start = parts.length >= 3 && !MEDIA_KINDS.has(parts[0] ?? "") ? 1 : 0;
  const kind = MEDIA_KINDS.get(parts[start] ?? "");
  const code = parts[start + 1];
  if (kind === undefined || code === undefined || !CODE.test(code)) {
    return undefined;
  }
  const path = kind === "post" ? "p" : "reel";
  return {
    code,
    embedUrl: `${BASE}/${path}/${code}/embed/`,
    kind,
    url: `${BASE}/${path}/${code}/`,
  };
};
