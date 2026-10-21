/**
 * Turns a phone photo (often 4 to 12 MB, sometimes HEIC) into a small JPEG
 * before it leaves the browser. Redrawing it on a canvas also drops EXIF,
 * including the location the phone stamped on it. Browsers apply the photo's
 * own rotation when drawing an <img>, so portraits stay upright.
 */
import { MAX_PHOTO_BASE64 } from "@/lib/booking/photo-limits";

/** Longest edge in pixels: plenty for Ani to judge color and length. */
const MAX_EDGE = 1600;

export class UnreadablePhotoError extends Error {
  override readonly name = "UnreadablePhotoError";
}

const load = async (url: string) => {
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    throw new UnreadablePhotoError("decode failed");
  }
  return image;
};

const encode = (image: HTMLImageElement, edge: number, quality: number) => {
  const scale = Math.min(
    1,
    edge / Math.max(image.naturalWidth, image.naturalHeight)
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new UnreadablePhotoError("no canvas");
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas
    .toDataURL("image/jpeg", quality)
    .replace(/^data:image\/jpeg;base64,/u, "");
};

/** Base64 JPEG, small enough to send with the booking. */
export const shrinkPhoto = async (file: File): Promise<string> => {
  // The object URL must outlive the drawing: some browsers decode lazily.
  const url = URL.createObjectURL(file);
  try {
    const image = await load(url);
    const attempts = [
      { edge: MAX_EDGE, quality: 0.82 },
      { edge: 1200, quality: 0.75 },
      { edge: 900, quality: 0.7 },
    ];
    for (const attempt of attempts) {
      const data = encode(image, attempt.edge, attempt.quality);
      if (data.length <= MAX_PHOTO_BASE64) {
        return data;
      }
    }
    throw new UnreadablePhotoError("too large");
  } finally {
    URL.revokeObjectURL(url);
  }
};
