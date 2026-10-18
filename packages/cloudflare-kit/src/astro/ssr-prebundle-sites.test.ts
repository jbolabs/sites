import path from "node:path";
import { pathToFileURL } from "node:url";

import { Schema } from "effect";
import { beforeAll, describe, expect, it } from "vitest";

import { ssrPrebundle } from "./ssr-prebundle.ts";

const repoRoot = path.join(import.meta.dirname, "../../../..");
const siteApps = [
  "access-electric",
  "agape-church",
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

const siteDirectory = (site: string) => path.join(repoRoot, "apps", site);

const included = new Map<string, readonly string[] | undefined>();

describe("site astro.config ssrPrebundle", () => {
  // The first `import()` of an astro.config cold-loads Astro, Vite and EmDash,
  // which passed 15s on CI runners busy with every site's typecheck. Load all
  // of them once here, under one generous limit, so each site's test is quick.
  beforeAll(async () => {
    const loaded = await Promise.all(
      siteApps.map(async (site) => {
        const config = Schema.decodeUnknownSync(AstroConfigModule)(
          await import(
            pathToFileURL(path.join(siteDirectory(site), "astro.config.ts"))
              .href
          )
        );
        return [site, config.default.vite?.ssr?.optimizeDeps?.include] as const;
      })
    );
    for (const [site, include] of loaded) {
      included.set(site, include);
    }
  }, 90_000);

  it.each(siteApps)("%s lists every SSR dep the helper computes", (site) => {
    const expected = ssrPrebundle(path.join(siteDirectory(site), "src"));
    expect(expected.length).toBeGreaterThan(0);
    expect(included.get(site)).toStrictEqual(expected);
  });
});
