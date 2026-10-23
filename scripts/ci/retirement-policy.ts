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
  // Preview for a PR closed unmerged, so the janitor (which reads main) misses it.
  "agape-church/pr-52",
]);

export const retirementSite = (site: string, stage: string): void => {
  if (!RETIREMENTS.has(`${site}/${stage}`)) {
    throw new Error(`Refusing retirement of ${site}/${stage}`);
  }
};
