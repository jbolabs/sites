import { describe, expect, it } from "vitest";

import { affectedSites, comparisonSites, lockfileSites } from "./affected.ts";

const sites = ["access-electric", "ms-homes"];

describe(affectedSites, () => {
  it("scopes app changes to that app", () => {
    expect(
      affectedSites(["apps/ms-homes/src/pages/index.astro"], sites)
    ).toStrictEqual({ deploy: ["ms-homes"], verify: ["ms-homes"] });
  });

  it("deploys every site when shared code changes", () => {
    const every = { deploy: sites, verify: sites };
    expect(
      affectedSites(["packages/cloudflare-kit/src/server/email.ts"], sites)
    ).toStrictEqual(every);
    expect(affectedSites(["bun.lock"], sites)).toStrictEqual(every);
  });

  it("deploys every site when a script that runs inside the deploy changes", () => {
    expect(affectedSites(["scripts/ci/migrate.ts"], sites)).toStrictEqual({
      deploy: ["access-electric", "ms-homes"],
      verify: ["access-electric", "ms-homes"],
    });
  });

  it("verifies every site but deploys none when only verification tooling changes", () => {
    const verifyOnly = { deploy: [], verify: sites };
    expect(affectedSites(["lighthouserc.json"], sites)).toStrictEqual(
      verifyOnly
    );
    expect(
      affectedSites(["packages/control-app/src/seo.ts"], sites)
    ).toStrictEqual(verifyOnly);
    expect(affectedSites(["scripts/ci/local-verify.ts"], sites)).toStrictEqual(
      verifyOnly
    );
  });

  it("deploys only the changed app when tooling changes alongside it", () => {
    expect(
      affectedSites(
        [
          "apps/ms-homes/src/pages/index.astro",
          "packages/control-app/src/seo.ts",
        ],
        sites
      )
    ).toStrictEqual({ deploy: ["ms-homes"], verify: sites });
  });

  it("ignores tests and proof tooling, which no site bundles", () => {
    expect(
      affectedSites(
        [
          "packages/cloudflare-kit/src/astro/ssr-prebundle-sites.test.ts",
          "apps/ms-homes/src/lib/dates.test.ts",
          "packages/proof/src/cli.ts",
          "apps/access-electric/src/pages/index.astro",
        ],
        sites
      )
    ).toStrictEqual({
      deploy: ["access-electric"],
      verify: ["access-electric"],
    });
  });

  it("deploys nothing for docs-only changes", () => {
    expect(affectedSites(["docs/stack.md", "AGENTS.md"], sites)).toStrictEqual({
      deploy: [],
      verify: [],
    });
  });
});

const lockfile = {
  catalog: { astro: "6.0.0" },
  lockfileVersion: 2,
  packages: {
    "@sites/access-electric": [
      "@sites/access-electric@workspace:apps/access-electric",
    ],
    astro: ["astro@6.0.0", "", {}, "sha512-a"],
  },
  workspaces: {
    "apps/access-electric": {
      dependencies: { astro: "catalog:" },
      name: "@sites/access-electric",
    },
  },
};

const withNewSite = {
  ...lockfile,
  packages: {
    ...lockfile.packages,
    "@sites/ms-homes": ["@sites/ms-homes@workspace:apps/ms-homes"],
  },
  workspaces: {
    ...lockfile.workspaces,
    "apps/ms-homes": {
      dependencies: { astro: "catalog:" },
      name: "@sites/ms-homes",
    },
  },
};

describe(lockfileSites, () => {
  it("scopes a new site's lockfile entries to that site", () => {
    const scope = lockfileSites(lockfile, withNewSite, sites);
    expect(scope).toStrictEqual(["ms-homes"]);
    expect(affectedSites(["bun.lock"], sites, scope)).toStrictEqual({
      deploy: ["ms-homes"],
      verify: ["ms-homes"],
    });
  });

  it("scopes a site taking an already resolved catalog dependency", () => {
    const head = {
      ...lockfile,
      workspaces: {
        "apps/access-electric": {
          dependencies: { astro: "catalog:", react: "catalog:" },
          name: "@sites/access-electric",
        },
      },
    };
    expect(lockfileSites(lockfile, head, sites)).toStrictEqual([
      "access-electric",
    ]);
  });

  it("affects every site when a resolved version or the catalog changes", () => {
    const bumped = {
      ...withNewSite,
      catalog: { astro: "6.1.0" },
      packages: {
        ...withNewSite.packages,
        astro: ["astro@6.1.0", "", {}, "sha512-b"],
      },
    };
    expect(lockfileSites(lockfile, bumped, sites)).toBeUndefined();
    expect(affectedSites(["bun.lock"], sites)).toStrictEqual({
      deploy: sites,
      verify: sites,
    });
  });
});

describe("built-output pruning", () => {
  it("prunes unused shared exports while keeping the site's changed output", () => {
    expect(
      affectedSites(
        [
          "packages/cloudflare-kit/src/server/index.ts",
          "apps/access-electric/src/pages/index.astro",
        ],
        sites,
        undefined,
        {
          base: { "access-electric": "worker-v1", "ms-homes": "same-worker" },
          head: { "access-electric": "worker-v2", "ms-homes": "same-worker" },
        }
      )
    ).toStrictEqual({
      deploy: ["access-electric"],
      verify: ["access-electric"],
    });
  });

  it("re-verifies unchanged output when verification tooling changes", () => {
    expect(
      affectedSites(
        [
          "packages/cloudflare-kit/src/server/index.ts",
          "packages/control-app/src/seo.ts",
        ],
        sites,
        undefined,
        {
          base: { "access-electric": "same", "ms-homes": "same" },
          head: { "access-electric": "same", "ms-homes": "same" },
        }
      )
    ).toStrictEqual({ deploy: [], verify: ["access-electric", "ms-homes"] });
  });

  it("keeps all sites when shared runtime output changes", () => {
    expect(
      affectedSites(
        ["packages/site-ui/src/mobile-menu.tsx"],
        sites,
        undefined,
        {
          base: { "access-electric": "old-a", "ms-homes": "old-b" },
          head: { "access-electric": "new-a", "ms-homes": "new-b" },
        }
      )
    ).toStrictEqual({
      deploy: ["access-electric", "ms-homes"],
      verify: ["access-electric", "ms-homes"],
    });
  });

  it("fails closed for missing fingerprints and new sites; ignores deleted sites", () => {
    expect(
      affectedSites(
        [
          "packages/cloudflare-kit/src/server/index.ts",
          "apps/deleted-site/alchemy.run.ts",
        ],
        sites,
        undefined,
        {
          base: { "access-electric": "old" },
          head: { "ms-homes": "new-site" },
        }
      )
    ).toStrictEqual({
      deploy: ["access-electric", "ms-homes"],
      verify: ["access-electric", "ms-homes"],
    });
  });

  it("does not add candidates from equal or changed fingerprints alone", () => {
    expect(
      affectedSites(
        ["apps/access-electric/src/pages/index.astro"],
        sites,
        undefined,
        {
          base: { "access-electric": "same", "ms-homes": "old" },
          head: { "access-electric": "same", "ms-homes": "new" },
        }
      )
    ).toStrictEqual({ deploy: [], verify: [] });
  });

  it("includes shared stack changes and ignores site documentation", () => {
    expect(
      affectedSites(["stacks/config.ts", "apps/ms-homes/README.md"], sites)
    ).toStrictEqual({
      deploy: ["access-electric", "ms-homes"],
      verify: ["access-electric", "ms-homes"],
    });
  });
});

describe(comparisonSites, () => {
  const onBase = new Set(["access-electric", "ms-homes"]);

  it("builds nothing to compare when only a site's own files changed", () => {
    expect(
      comparisonSites(
        ["apps/access-electric/src/pages/index.astro"],
        ["access-electric"],
        onBase
      )
    ).toStrictEqual([]);
  });

  it("compares existing candidates when shared code changed, skipping new sites", () => {
    expect(
      comparisonSites(
        ["packages/cloudflare-kit/src/server/index.ts"],
        ["access-electric", "ani-wenger", "ms-homes"],
        onBase
      )
    ).toStrictEqual(["access-electric", "ms-homes"]);
  });
});
