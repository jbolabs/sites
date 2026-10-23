/**
 * Reads an image's format and pixel size from its header bytes, so the audit
 * can check social cards and icons without an image library.
 */

export type ImageFormat = "png" | "jpeg" | "webp" | "gif";

export interface ImageSize {
  readonly format: ImageFormat;
  readonly width: number;
  readonly height: number;
}

const ascii = (bytes: Uint8Array, start: number, length: number): string =>
  String.fromCodePoint(...bytes.subarray(start, start + length));

const png = (view: DataView): ImageSize => ({
  format: "png",
  height: view.getUint32(20),
  width: view.getUint32(16),
});

const gif = (view: DataView): ImageSize => ({
  format: "gif",
  height: view.getUint16(8, true),
  width: view.getUint16(6, true),
});

/** WebP stores dimensions in 14-bit and 24-bit little-endian fields. */
const BITS_14 = 2 ** 14;
const BYTE = 2 ** 8;

const uint24 = (view: DataView, offset: number): number =>
  view.getUint8(offset) +
  view.getUint8(offset + 1) * BYTE +
  view.getUint8(offset + 2) * BYTE * BYTE;

const webp = (bytes: Uint8Array, view: DataView): ImageSize | undefined => {
  const chunk = ascii(bytes, 12, 4);
  if (chunk === "VP8X") {
    return {
      format: "webp",
      height: uint24(view, 27) + 1,
      width: uint24(view, 24) + 1,
    };
  }
  if (chunk === "VP8L") {
    const bits = view.getUint32(21, true);
    return {
      format: "webp",
      height: (Math.floor(bits / BITS_14) % BITS_14) + 1,
      width: (bits % BITS_14) + 1,
    };
  }
  if (chunk === "VP8 ") {
    return {
      format: "webp",
      height: view.getUint16(28, true) % BITS_14,
      width: view.getUint16(26, true) % BITS_14,
    };
  }
  return undefined;
};

/** Start-of-frame markers (baseline, progressive, ...) carry the dimensions; DHT/JPG/DAC (C4, C8, CC) do not. */
const START_OF_FRAME = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

const jpeg = (view: DataView): ImageSize | undefined => {
  let offset = 2;
  while (offset + 9 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      return undefined;
    }
    const marker = view.getUint8(offset + 1);
    if (START_OF_FRAME.has(marker)) {
      return {
        format: "jpeg",
        height: view.getUint16(offset + 5),
        width: view.getUint16(offset + 7),
      };
    }
    offset += 2 + view.getUint16(offset + 2);
  }
  return undefined;
};

export const imageSize = (bytes: Uint8Array): ImageSize | undefined => {
  if (bytes.length < 30) {
    return undefined;
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (ascii(bytes, 1, 3) === "PNG") {
    return png(view);
  }
  if (ascii(bytes, 0, 3) === "GIF") {
    return gif(view);
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return webp(bytes, view);
  }
  if (view.getUint16(0) === 0xff_d8) {
    return jpeg(view);
  }
  return undefined;
};
