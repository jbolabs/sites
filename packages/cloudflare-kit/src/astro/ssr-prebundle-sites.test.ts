import path from "node:path";
import { pathToFileURL } from "node:url";

import { Schema } from "effect";
import { beforeAll, describe, expect, it } from "vitest";

import { ssrPrebundle } from "./ssr-prebundle.ts";

const repoRoot = path.join(import.meta.dirname, "../../../..");
const siteApps = [
  "ani-wenger",
  "bodycentre-day-spa",
  "equityfast",
  "ms-custom-homes",
] as const;

const AstroConfigModule = Schema.Struct({
  default: Schema.Struct({
    vite: Schema.optional(
      Schema.Struct({
        ssr: Schema.optional(
          Schema.Struct({
            optimizeDeps: Schema.optional(
              Schema.Struct({
                include: Schema.optional(Schema.Array(Schema.String)),
              })
            ),
          })
        ),
      })
    ),
  }),
});

const configUrl = (site: string) =>
  pathToFileURL(path.join(repoRoot, "apps", site, "astro.config.ts")).href;

describe("site astro.config ssrPrebundle", () => {
  // The first astro.config import loads Astro, Vite, EmDash, and Alchemy cold (about 14 s on
  // CI runners); pay it once here so each case times only its own config.
  beforeAll(async () => {
    await import(configUrl(siteApps[0]));
  }, 90_000);

  it.each(siteApps)(
    "%s lists every SSR dep the helper computes",
    // A warm import of one more site's astro.config can still exceed 5 s on CI runners.
    { timeout: 15_000 },
    async (site) => {
      const directory = path.join(repoRoot, "apps", site);
      const sourceDirectory = path.join(directory, "src");
      const expected = ssrPrebundle(sourceDirectory);
      const loaded = Schema.decodeUnknownSync(AstroConfigModule)(
        await import(configUrl(site))
      );
      expect(loaded.default.vite?.ssr?.optimizeDeps?.include).toStrictEqual(
        expected
      );
    }
  );
});
