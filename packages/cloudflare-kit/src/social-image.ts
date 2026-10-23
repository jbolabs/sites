/**
 * The image a link preview (Open Graph, X, iMessage, Slack, WhatsApp) shows for
 * a page. Every site's base layout resolves `og:image` here, so a page can hand
 * over any CMS photo and still get something scrapers accept: an absolute URL
 * to a JPEG at least 1200 wide. `bun run app -- seo` checks the result
 * (`social-image`).
 */
import { MEDIA_PATH, mediaPath } from "./media.ts";
import type { MediaFile } from "./media.ts";

export type { MediaFile } from "./media.ts";

/** Large-card width; previews crop to 1.91:1 (1200x630). */
export const SOCIAL_IMAGE_WIDTH = 1200;
/** Below this, scrapers drop to a small card or no image (the `social-image` error). */
export const SOCIAL_IMAGE_MIN = { height: 315, width: 600 } as const;

/**
 * An entry photo too small for a large card is skipped in favour of the
 * site's default card. The `/_image` endpoint never upscales, so the
 * original size is what scrapers get. Unknown sizes are trusted.
 */
const largeEnough = (photo: MediaFile): boolean =>
  (photo.width === undefined || photo.width >= SOCIAL_IMAGE_MIN.width) &&
  (photo.height === undefined || photo.height >= SOCIAL_IMAGE_MIN.height);

export interface SocialImageInput {
  /** The editor's SEO image for this page (a URL). */
  readonly image?: string | null | undefined;
  /**
   * A photo from the entry, used when the editor set no SEO image. EmDash
   * returns `null` for an empty image field, whatever the generated types say.
   */
  readonly photo?: MediaFile | null | undefined;
  /** Settings → SEO → Default OG image, when an editor set one. */
  readonly siteDefault?: string | undefined;
  /** The site's branded 1200x630 card in `public/`. */
  readonly fallback: string;
  readonly origin: string;
}

const firstSource = (input: SocialImageInput): string | undefined =>
  [
    input.image ?? "",
    input.photo === undefined ||
    input.photo === null ||
    !largeEnough(input.photo)
      ? ""
      : mediaPath(input.photo),
    input.siteDefault ?? "",
  ].find((source) => source !== "");

/**
 * SEO image, then the entry's photo (if large enough), then the CMS default, then the site's
 * static card. CMS media goes through EmDash's `/_image` endpoint as a JPEG
 * (previews skip WebP/AVIF). The endpoint ignores `fit`, so only the width is
 * set: a photo keeps its shape and previews crop it themselves.
 */
export const socialImage = (input: SocialImageInput): string => {
  const source = firstSource(input);
  if (source === undefined) {
    return new URL(input.fallback, input.origin).href;
  }
  const url = new URL(source, input.origin);
  if (!url.pathname.startsWith(MEDIA_PATH)) {
    return url.href;
  }
  const card = new URL("/_image", input.origin);
  card.searchParams.set("href", url.pathname);
  card.searchParams.set("w", String(SOCIAL_IMAGE_WIDTH));
  card.searchParams.set("f", "jpeg");
  return card.href;
};
