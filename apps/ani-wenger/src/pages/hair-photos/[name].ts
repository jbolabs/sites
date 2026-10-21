/**
 * A client's hair photo, by its random name (see `lib/booking/hair-photos.ts`).
 * Only Ani gets these links (her schedule, her new-booking email), so the
 * response is private, uncached by shared caches, and kept out of search.
 */
import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

import { PHOTO_NAME } from "@/lib/booking/hair-photos";

const PRIVATE_HEADERS = {
  "cache-control": "private, max-age=86400",
  "referrer-policy": "no-referrer",
  // Only the first bytes are checked on upload; never let a browser guess another type.
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow",
};

const hairPhoto: APIRoute = async ({ params }) => {
  const name = params.name ?? "";
  const photo = PHOTO_NAME.test(name) ? await env.HAIR_PHOTOS.get(name) : null;
  if (photo === null) {
    return new Response("Not found", { headers: PRIVATE_HEADERS, status: 404 });
  }
  return new Response(photo.body, {
    headers: { ...PRIVATE_HEADERS, "content-type": "image/jpeg" },
  });
};

export const GET = hairPhoto;
