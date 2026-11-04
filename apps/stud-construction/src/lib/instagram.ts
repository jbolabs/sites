/**
 * Instagram links on a project: a post or reel embeds on the project page, a
 * story highlight (a saved set of reels) shows as a link. Editors paste
 * whatever the Share button gives them; this reads it and returns one clean
 * canonical form, or `undefined` for anything that is not one of those.
 */
export type InstagramLink =
  | {
      readonly kind: "post" | "reel";
      /** The media's shortcode, e.g. `C1a2B3c4D5e`. */
      readonly code: string;
      /** Instagram's embed page, loaded in an iframe. */
      readonly embedUrl: string;
      readonly url: string;
    }
  | {
      readonly kind: "highlight";
      readonly id: string;
      readonly url: string;
    };

const HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "m.instagram.com",
]);
const CODE = /^[\w-]{5,40}$/u;
const HIGHLIGHT_ID = /^\d{5,30}$/u;
const BASE = "https://www.instagram.com";

/** The kind of media a path segment names; `tv` is the old IGTV path for what are now reels. */
const MEDIA_KINDS = new Map<string, "post" | "reel">([
  ["p", "post"],
  ["reel", "reel"],
  ["reels", "reel"],
  ["tv", "reel"],
]);

const media = (
  kind: "post" | "reel",
  code: string | undefined
): InstagramLink | undefined => {
  if (code === undefined || !CODE.test(code)) {
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

export const instagramLink = (raw: string): InstagramLink | undefined => {
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
  const [first = "", second = "", third] = parts;
  if (first === "stories" && second === "highlights") {
    const id = third;
    return id !== undefined && HIGHLIGHT_ID.test(id)
      ? { id, kind: "highlight", url: `${BASE}/stories/highlights/${id}/` }
      : undefined;
  }
  // Share links come as /reel/<code>/ or, newer, /<username>/reel/<code>/.
  const start = parts.length >= 3 && !MEDIA_KINDS.has(first) ? 1 : 0;
  const kind = MEDIA_KINDS.get(parts[start] ?? "");
  return kind === undefined ? undefined : media(kind, parts[start + 1]);
};

/** Instagram links on a saved project: the clean ones, or why one was refused. */
export interface CheckedLinks {
  readonly urls: readonly string[];
  /** The message the editor sees when a link is not an Instagram post, reel, or highlight. */
  readonly refused?: string;
}

/** Blank rows are dropped, so an empty "Add" row never blocks a save. */
export const checkInstagramLinks = (raw: readonly string[]): CheckedLinks => {
  const urls: string[] = [];
  for (const row of raw) {
    const text = row.trim();
    if (text === "") {
      continue;
    }
    const link = instagramLink(text);
    if (link === undefined) {
      return {
        refused: `"${text}" is not an Instagram post, reel, or highlight. In Instagram, tap Share, then Copy link, and paste that link here.`,
        urls: [],
      };
    }
    urls.push(link.url);
  }
  return { urls };
};
