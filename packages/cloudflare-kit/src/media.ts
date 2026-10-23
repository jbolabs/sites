/**
 * Locates EmDash media files for code that cannot use EmDash's `<Image>`
 * (React islands, link-preview cards).
 */
import { Option, Schema } from "effect";

/** Where EmDash serves uploaded media; its `/_image` endpoint resizes only these. */
export const MEDIA_PATH = "/_emdash/api/media/file/";

/** The parts of an EmDash media value that locate its file. */
export interface MediaFile {
  readonly id: string;
  readonly src?: string | undefined;
  readonly meta?: { readonly storageKey?: unknown } | undefined;
}

/** Where EmDash serves a media file (mirrors EmDash's own resolution). */
export const mediaPath = (image: MediaFile): string => {
  if (image.src !== undefined && image.src !== "") {
    return image.src;
  }
  const key = Schema.decodeUnknownOption(Schema.NonEmptyString)(
    image.meta?.storageKey
  ).pipe(Option.getOrElse(() => image.id));
  return `${MEDIA_PATH}${key}`;
};
