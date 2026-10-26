/**
 * What the kit's `<Image>` hands EmDash's for one CMS image: the image with
 * its seed placeholder (`seed-placeholders.ts`) and srcset widths that stop at
 * the original's size (`image-widths.ts`).
 */
import { Option, Schema } from "effect";

import { photoWidths } from "./image-widths.ts";
import { withSeedPlaceholder } from "./seed-placeholders.ts";
import type { SeedPlaceholders } from "./seed-placeholders.ts";

/** A media value with the original size EmDash recorded. */
const SizedPhoto = Schema.Struct({
  width: Schema.Finite.check(Schema.isGreaterThan(0)),
});

export interface PhotoProps<Image> {
  readonly image: Image;
  /** Undefined when the original's size is unknown: Astro's own widths apply. */
  readonly widths: readonly number[] | undefined;
}

export const photoProps = <Image>(
  image: Image,
  placeholders: SeedPlaceholders
): PhotoProps<Image> => ({
  image: withSeedPlaceholder(image, placeholders),
  widths: Schema.decodeUnknownOption(SizedPhoto)(image).pipe(
    Option.map(({ width }) => photoWidths(width)),
    Option.getOrUndefined
  ),
});
