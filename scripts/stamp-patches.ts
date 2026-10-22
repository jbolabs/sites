/**
 * Vite keys its dependency cache on the lockfile plus the `patches/` directory's mtime.
 * Editing a patch in place leaves that mtime alone, so dev keeps serving the unpatched
 * prebundle until someone deletes `node_modules/.vite`. Run from `prepare` on every
 * `bun install`: the mtime becomes a hash of the patches, so a changed patch busts the
 * cache and an unchanged one keeps it warm.
 *
 *   bun scripts/stamp-patches.ts
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, utimesSync } from "node:fs";
import path from "node:path";

export interface PatchFile {
  readonly name: string;
  readonly content: string;
}

/** Seconds since the epoch, between 2001 and 2033, derived only from the patches. */
export const patchesStamp = (files: readonly PatchFile[]): number => {
  const hash = createHash("sha256");
  for (const file of files.toSorted((a, b) => a.name.localeCompare(b.name))) {
    hash.update(`${file.name}\0${file.content}\0`);
  }
  return (
    1_000_000_000 +
    (Number.parseInt(hash.digest("hex").slice(0, 8), 16) % 1_000_000_000)
  );
};

if (import.meta.main) {
  const dir = path.join(import.meta.dirname, "..", "patches");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".patch"))
    .map((name) => ({
      content: readFileSync(path.join(dir, name), "utf-8"),
      name,
    }));
  const stamp = patchesStamp(files);
  utimesSync(dir, stamp, stamp);
}
