/**
 * Deliberately limited to stacks the owner approved for retirement. Each entry
 * names a stage whose app code is gone or superseded, so its own stack cannot
 * destroy it. Retained resources (prod D1/R2) stay; only the rest is deleted.
 */
const RETIREMENTS: ReadonlySet<string> = new Set([
  // Pre-monorepo stacks, replaced by the `<app>-staging` sites (audit 2026-10-22).
  "AccessElectric/live_jakebodea",
  "BlackSwanRealty/live_jakebodea",
  "MsCustomHomes/live_jakebodea",
  // Domainless prod stages kept from before ADR 0005; staging serves these apps now.
  "access-electric/prod",
  "ms-custom-homes/prod",
  // Its app directory was removed (ADR 0010), so the site stack can't load to destroy it.
  "access-electric/staging",
  // Preview for a PR closed unmerged, so the janitor (which reads main) misses it.
  "agape-church/pr-52",
]);

export const retirementSite = (site: string, stage: string): void => {
  if (!RETIREMENTS.has(`${site}/${stage}`)) {
    throw new Error(`Refusing retirement of ${site}/${stage}`);
  }
};

/**
 * Pre-monorepo buckets recorded without `forceDestroy`, so R2 refuses to delete
 * them while they hold media. Deploying the retirement stack re-declares each
 * one with `forceDestroy` (owner approved discarding the media), then destroy
 * empties and deletes it.
 */
const FORCE_EMPTY_BUCKETS: ReadonlyMap<string, string> = new Map([
  [
    "AccessElectric/live_jakebodea",
    "accesselectric-bucket-live-jakebodea-jx3taprabzlbumwo",
  ],
  [
    "BlackSwanRealty/live_jakebodea",
    "blackswanrealty-bucket-live-jakebodea-fmt3sbj54itxgzt5",
  ],
  [
    "MsCustomHomes/live_jakebodea",
    "mscustomhomes-bucket-live-jakebodea-xr62b3r54swd3nfc",
  ],
]);

/** The legacy bucket a retired stage must force-empty, if any. */
export const forceEmptyBucket = (
  site: string,
  stage: string
): string | undefined => FORCE_EMPTY_BUCKETS.get(`${site}/${stage}`);
