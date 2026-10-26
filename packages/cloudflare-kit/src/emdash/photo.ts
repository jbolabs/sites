/**
 * What the kit's `<Image>` hands EmDash's for one CMS image: the image with
 * its seed placeholder (`seed-placeholders.ts`), srcset widths that stop at
 * the original's size (`image-widths.ts`), and the placeholder style.
 *
 * The style is written here because EmDash's is invalid CSS: it renders
 * `@unpic/placeholder`'s `background: url(...) cover` (a size needs a
 * position and a slash), which browsers drop, so not even CMS uploads showed
 * their blurhash. EmDash's own is turned off and this one also carries the
 * focal point's `object-position` that EmDash's style would have set.
 */
import { blurhashToDataUri } from "@unpic/placeholder";
import { Option, Schema } from "effect";

import { photoWidths } from "./image-widths.ts";
import { withSeedPlaceholder } from "./seed-placeholders.ts";
import type { SeedPlaceholders } from "./seed-placeholders.ts";

const Coordinate = Schema.Finite.check(
  Schema.isBetween({ maximum: 1, minimum: 0 })
);
/** The parts of an EmDash media value that size and dress a photo. */
const PhotoFields = Schema.Struct({
  blurhash: Schema.optional(Schema.String),
  dominantColor: Schema.optional(Schema.String),
  focalX: Schema.optional(Coordinate),
  focalY: Schema.optional(Coordinate),
  width: Schema.optional(Schema.Finite.check(Schema.isGreaterThan(0))),
});
type PhotoFields = typeof PhotoFields.Type;

export interface PhotoProps<Image> {
  readonly image: Image;
  /** Undefined when the original's size is unknown: Astro's own widths apply. */
  readonly widths: readonly number[] | undefined;
  /** Placeholder background and focal point, or undefined when there is neither. */
  readonly style: string | undefined;
}

const percent = (coordinate: number): string =>
  `${Math.round(coordinate * 10_000) / 100}%`;

const placeholderStyle = ({ blurhash, dominantColor }: PhotoFields): string => {
  const layers = [
    blurhash === undefined
      ? ""
      : `url("${blurhashToDataUri(blurhash)}") center / cover no-repeat`,
    dominantColor ?? "",
  ].filter((layer) => layer !== "");
  return layers.length === 0 ? "" : `background: ${layers.join(" ")};`;
};

const focalStyle = ({ focalX, focalY }: PhotoFields): string =>
  focalX === undefined || focalY === undefined
    ? ""
    : `object-position: ${percent(focalX)} ${percent(focalY)};`;

export const photoProps = <Image>(
  image: Image,
  placeholders: SeedPlaceholders,
  { placeholder = true }: { readonly placeholder?: boolean | undefined } = {}
): PhotoProps<Image> => {
  const filled = withSeedPlaceholder(image, placeholders);
  const fields = Option.getOrElse(
    Schema.decodeUnknownOption(PhotoFields)(filled),
    (): PhotoFields => ({})
  );
  const style = [
    placeholder ? placeholderStyle(fields) : "",
    focalStyle(fields),
  ]
    .filter((part) => part !== "")
    .join(" ");
  return {
    image: filled,
    style: style === "" ? undefined : style,
    widths: fields.width === undefined ? undefined : photoWidths(fields.width),
  };
};
