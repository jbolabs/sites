/* oxlint-disable typescript/triple-slash-reference -- Ambient virtual-module types must be included by consuming Astro projects. */
/// <reference path="./seed-placeholders-virtual.d.ts" />
/**
 * Blurred placeholders for a seed's own photos. EmDash computes a blurhash and
 * dominant color when a photo is uploaded in the CMS, but not when setup
 * downloads `$media` from the seed, so seeded photos (and every page still
 * using them) showed an empty box until the file arrived. Decoding a photo
 * takes about half a second, too slow for setup on a Worker, so they are
 * computed at build time (`seedMedia`) with EmDash's own generator, kept in
 * `seed/placeholders.json`, and filled in here when a page renders.
 */
import { Option, Schema } from "effect";

export const SeedPlaceholder = Schema.Struct({
  blurhash: Schema.String,
  /** Size of the photo it was computed from, so a replaced photo is redone. */
  bytes: Schema.Number,
  dominantColor: Schema.String,
});
export type SeedPlaceholder = typeof SeedPlaceholder.Type;

export const SeedPlaceholders = Schema.Record(Schema.String, SeedPlaceholder);
/** Placeholders by seed photo filename (the `filename` EmDash keeps on the media value). */
export type SeedPlaceholders = typeof SeedPlaceholders.Type;

/** A media value from a file, with no placeholder of its own (a CMS upload has one). */
const SeedPhoto = Schema.Struct({
  blurhash: Schema.optional(Schema.Undefined),
  dominantColor: Schema.optional(Schema.Undefined),
  filename: Schema.String,
});

/** The image with its seed photo's placeholder, unless it already carries one. */
export const withSeedPlaceholder = <Image>(
  image: Image,
  placeholders: SeedPlaceholders
): Image =>
  Schema.decodeUnknownOption(SeedPhoto)(image).pipe(
    Option.flatMap(({ filename }) =>
      Option.fromNullishOr(placeholders[filename])
    ),
    Option.match({
      onNone: () => image,
      onSome: ({ blurhash, dominantColor }) => ({
        ...image,
        blurhash,
        dominantColor,
      }),
    })
  );
