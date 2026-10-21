/** Hair photo limits, shared by the booking island (which shrinks photos) and the server (which checks them). */

/** Photos per booking, both kinds together. */
export const MAX_PHOTOS = 4;
/** Photos of each kind ("now", "goal"). */
export const MAX_PHOTOS_PER_KIND = 2;
/** Bytes per photo after the browser's resize; a 1600px JPEG is well under. */
export const MAX_PHOTO_BYTES = 900_000;
/** The same limit as base64 characters, which is how the form sends photos. */
export const MAX_PHOTO_BASE64 = Math.ceil(MAX_PHOTO_BYTES / 3) * 4;
