/**
 * Srcset widths for an EmDash photo. Astro cannot read a remote original's
 * size, so its constrained layout offers up to twice the stated width: a
 * 2400px seed photo listed 2560w (an upscale) and 4800w, past the `/_image`
 * endpoint's 4000px limit, so a wide retina screen fetched the full original
 * JPEG. Here every width fits inside the original, up to 2560px (sharp on a
 * 1280px-wide slot at 2x; more only costs bytes).
 */
const WIDEST = 2560;
/** Astro's `LIMITED_RESOLUTIONS`: common phone, tablet and laptop widths. */
const BREAKPOINTS = [640, 750, 828, 1080, 1280, 1668, 2048, WIDEST];

/** Srcset widths for an original `width` pixels wide. */
export const photoWidths = (width: number): readonly number[] => {
  const widest = Math.min(Math.round(width), WIDEST);
  return [...BREAKPOINTS.filter((candidate) => candidate < widest), widest];
};
