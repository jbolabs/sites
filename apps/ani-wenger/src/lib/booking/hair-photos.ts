/**
 * Photos of a client's hair, sent with a booking so Ani can plan the
 * appointment (and catch a color correction booked as a color) before the
 * client sits down.
 *
 * The browser resizes each photo and re-encodes it as JPEG, which also drops
 * location data, so the server only accepts small JPEGs. They live in their
 * own private R2 bucket (never the public media library) under random names;
 * like Ani's calendar feed, the address is the credential (ADR 8). The bucket
 * deletes them after a year.
 */
import { Effect, Layer, Option, Schema } from "effect";

import { MAX_PHOTO_BASE64, MAX_PHOTO_BYTES } from "./photo-limits.ts";
import { HairPhotos, PHOTO_KINDS, StoreFailed } from "./services.ts";
import type { HairPhotoLink, PhotoKind } from "./services.ts";

export const PHOTO_NAME = /^[a-f0-9]{32}\.jpg$/u;

/** A photo as the booking form sends it: base64 JPEG without a data-URL prefix. */
export const PhotoUpload = Schema.Struct({
  data: Schema.String.check(Schema.isMaxLength(MAX_PHOTO_BASE64)),
  kind: Schema.Literals(PHOTO_KINDS),
});
export type PhotoUpload = typeof PhotoUpload.Type;

/** The photo is not a JPEG, is empty, or is too large. */
export class PhotoRejected extends Schema.TaggedError<PhotoRejected>()(
  "PhotoRejected",
  {}
) {}

const isJpeg = (bytes: Uint8Array) =>
  bytes.length > 3 &&
  bytes[0] === 0xff &&
  bytes[1] === 0xd8 &&
  bytes[2] === 0xff;

const fromBase64 = (data: string): Option.Option<Uint8Array> => {
  try {
    return Option.some(
      Uint8Array.from(atob(data), (char) => char.codePointAt(0) ?? 0)
    );
  } catch {
    return Option.none();
  }
};

/** Decodes and checks one upload; anything that is not a small JPEG is refused. */
export const decodePhoto = (upload: PhotoUpload) =>
  fromBase64(upload.data).pipe(
    Option.filter((bytes) => isJpeg(bytes) && bytes.length <= MAX_PHOTO_BYTES),
    Option.match({
      onNone: () => Effect.fail(new PhotoRejected()),
      onSome: (bytes) => Effect.succeed({ bytes, kind: upload.kind }),
    })
  );

const LABEL: Record<PhotoKind, string> = { goal: "Goal", now: "Now" };

/**
 * How links are stored in the appointment's "Hair photos" field: one per
 * line, readable in the admin ("Now: https://…/hair-photos/….jpg").
 */
export const photosText = (
  links: readonly HairPhotoLink[],
  origin: string
): string =>
  links.map((link) => `${LABEL[link.kind]}: ${origin}${link.path}`).join("\n");

/** Reads the field back; lines an editor changed into something else are skipped. */
export const parsePhotosText = (
  text: string | null | undefined
): HairPhotoLink[] =>
  (text ?? "").split("\n").flatMap((line): HairPhotoLink[] => {
    const match =
      /^(?<label>Now|Goal):\s+\S*?(?<path>\/hair-photos\/[a-f0-9]{32}\.jpg)\s*$/u.exec(
        line.trim()
      );
    if (match === null) {
      return [];
    }
    const { label, path } = match.groups ?? {};
    return path === undefined
      ? []
      : [{ kind: label === "Goal" ? "goal" : "now", path }];
  });

const randomName = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}.jpg`;
};

/** `HairPhotos` on the `HAIR_PHOTOS` R2 bucket. */
export const hairPhotosR2 = (bucket: R2Bucket) =>
  Layer.succeed(HairPhotos, {
    put: (jpeg) => {
      const name = randomName();
      return Effect.tryPromise({
        catch: (cause) => new StoreFailed({ cause }),
        try: async () =>
          await bucket.put(name, jpeg, {
            httpMetadata: { contentType: "image/jpeg" },
          }),
      }).pipe(
        Effect.as(`/hair-photos/${name}`),
        Effect.withSpan("HairPhotos.put")
      );
    },
  });
