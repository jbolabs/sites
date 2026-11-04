/**
 * Which sites a change touches, as two lists, because tooling can change how
 * a site is checked without changing what ships:
 *
 * - `verify`: sites whose required smoke, SEO and Lighthouse checks run.
 * - `deploy`: sites whose Worker could differ, so previews and prod redeploy them.
 *
 * Paths choose cheap candidates, then credential-free builds at the exact base
 * and head prune sites whose Worker/assets and deployment inputs match. Unknown
 * fingerprints fail closed. A change to the verifier itself checks one canary
 * site; other CI scripts ship in no site and are covered by their unit tests.
 * Main's deploy jobs also retry sites whose last release failed
 * (`release-records.ts`), so a fix outside `apps/<site>/` needs no redeploy-all.
 *
 *   bun scripts/ci/affected.ts <base-ref>                # prints `verify=[…]` and `deploy=[…]` lines
 *   bun scripts/ci/affected.ts <base-ref> --paths-only   # candidates only, no comparison builds
 *
 * CI verifies the `--paths-only` candidates so verification never waits on the
 * comparison builds; a separate job prunes `deploy` with them. Pruned `deploy`
 * is always a subset of those candidates, so every deployed site was verified.
 */
import { execFileSync } from "node:child_process";
import { isDeepStrictEqual } from "node:util";

import { Schema } from "effect";

import { compareRevisionFingerprints } from "./revision-build.ts";

export interface Affected {
  readonly deploy: readonly string[];
  readonly verify: readonly string[];
}

const SITE_PATH = /^apps\/(?<site>[^/]+)\//u;
/** Never built into a Worker nor run by a site's verification. */
const UNSHIPPED_PATHS = [
  /\.test\.tsx?$/u,
  /(?:^|\/)(?:README|CLAUDE|AGENTS)\.md$/u,
  /^(?:docs|\.agents|\.claude)\//u,
  /(?:^|\/)\.artifacts\//u,
  /^packages\/proof\//u,
];
/** The site that checks a change to the verifier; the reference site. */
export const CANARY_SITE = "ms-custom-homes";
/** Changes how sites are checked (smoke, SEO, Lighthouse) but ships in none: verify the canary. */
export const VERIFY_TOOLING_PATHS = [
  /^packages\/control-app\//u,
  /^scripts\/ci\/(?:command|control-check|lighthouse|local-verify|local-worker|verify-ci|verify-script)\.ts$/u,
  /^\.github\/(?:workflows\/ci\.yml|actions\/setup\/action\.yml)$/u,
  /^lighthouserc\.json$/u,
];
/** CI scripts outside the verifier and the comparison: their unit tests cover them. */
const CI_SCRIPT_PATH = /^scripts\/ci\/.*\.ts$/u;
const SHARED_PATHS = [
  /^packages\//u,
  /^stacks\//u,
  /^patches\//u,
  // Exercise the real comparison when its implementation changes.
  /^scripts\/ci\/(?:affected|revision-build|site-fingerprint)\.ts$/u,
  /^bun\.lock$/u,
  /^package\.json$/u,
  /^turbo\.json$/u,
  /^tsconfig\.json$/u,
  /^bunfig\.toml$/u,
];

const matchesAny = (file: string, patterns: readonly RegExp[]) =>
  patterns.some((pattern) => pattern.test(file));
const ciOnly = (file: string) =>
  CI_SCRIPT_PATH.test(file) &&
  !matchesAny(file, VERIFY_TOOLING_PATHS) &&
  !matchesAny(file, SHARED_PATHS);

const Entries = Schema.Record(Schema.String, Schema.Unknown);
const decodeEntries = Schema.decodeUnknownSync(Entries);
const WorkspaceName = Schema.Struct({ name: Schema.String });

/** A parsed `bun.lock`, compared section by section. */
export type Lockfile = Schema.Schema.Type<typeof Entries>;

/** `bun.lock` without the given sites' own workspace and package entries. */
const withoutSites = (lock: Lockfile, sites: readonly string[]) => {
  const workspaces = decodeEntries(lock.workspaces ?? {});
  const packages = decodeEntries(lock.packages ?? {});
  const own = new Set(
    sites.flatMap((site) => {
      const entry = workspaces[`apps/${site}`];
      return Schema.is(WorkspaceName)(entry)
        ? [`apps/${site}`, entry.name]
        : [`apps/${site}`];
    })
  );
  const keep = (entries: Lockfile) =>
    Object.fromEntries(
      Object.entries(entries).filter(([key]) => !own.has(key))
    );
  return { ...lock, packages: keep(packages), workspaces: keep(workspaces) };
};

/**
 * The sites whose own `bun.lock` entries changed, when nothing else in it did,
 * or `undefined` when the change reaches shared resolution (a version, the
 * catalog, a resolved package) and so every site.
 */
export const lockfileSites = (
  before: Lockfile,
  after: Lockfile,
  sites: readonly string[]
): readonly string[] | undefined => {
  if (
    !isDeepStrictEqual(withoutSites(before, sites), withoutSites(after, sites))
  ) {
    return undefined;
  }
  // Everything outside the sites' entries matched, so keeping one site's
  // entries leaves a difference exactly when that site's entries changed.
  return sites.filter((site) => {
    const others = sites.filter((other) => other !== site);
    return !isDeepStrictEqual(
      withoutSites(before, others),
      withoutSites(after, others)
    );
  });
};

export const affectedSites = (
  changedFiles: readonly string[],
  sites: readonly string[],
  /** From `lockfileSites`, when `bun.lock` changed only in sites' own entries. */
  lockfileScope?: readonly string[],
  fingerprints?: {
    readonly base: Readonly<Record<string, string | undefined>>;
    readonly head: Readonly<Record<string, string | undefined>>;
  }
): Affected => {
  const shipped = changedFiles
    .flatMap((file) =>
      file === "bun.lock" && lockfileScope !== undefined
        ? lockfileScope.map((site) => `apps/${site}/package.json`)
        : [file]
    )
    .filter((file) => !matchesAny(file, UNSHIPPED_PATHS));
  const tooling = shipped.filter((file) =>
    matchesAny(file, VERIFY_TOOLING_PATHS)
  );
  const runtime = shipped.filter(
    (file) => !matchesAny(file, VERIFY_TOOLING_PATHS) && !ciOnly(file)
  );
  const touched = new Set(
    runtime.flatMap((file) => {
      const site = SITE_PATH.exec(file)?.groups?.site;
      return site === undefined ? [] : [site];
    })
  );
  const candidates = runtime.some((file) => matchesAny(file, SHARED_PATHS))
    ? [...sites]
    : sites.filter((site) => touched.has(site));
  const deploy = candidates.filter((site) => {
    const before = fingerprints?.base[site];
    const after = fingerprints?.head[site];
    return before === undefined || after === undefined || before !== after;
  });
  const canary = sites.includes(CANARY_SITE)
    ? [CANARY_SITE]
    : sites.slice(0, 1);
  return {
    deploy,
    verify:
      tooling.length > 0
        ? [...new Set([...deploy, ...canary])].toSorted()
        : deploy,
  };
};

/**
 * The sites worth a comparison build. Only a shared change can leave a site's
 * output untouched; a change inside `apps/<site>/` ships anyway, so building
 * it twice would only add a minute to the commonest kind of PR. New sites
 * have no base to compare with.
 */
export const comparisonSites = (
  changedFiles: readonly string[],
  candidates: readonly string[],
  baseSites: ReadonlySet<string>
): readonly string[] =>
  changedFiles.some(
    (file) =>
      matchesAny(file, SHARED_PATHS) && !matchesAny(file, UNSHIPPED_PATHS)
  )
    ? candidates.filter((site) => baseSites.has(site))
    : [];

/** `$GITHUB_OUTPUT` lines for the `affected` job. */
const outputLines = ({ deploy, verify }: Affected) =>
  `verify=${JSON.stringify(verify)}\ndeploy=${JSON.stringify(deploy)}\n`;

/** True when `ref` names a commit in this clone. */
const isCommit = (ref: string, cwd: string): boolean => {
  try {
    execFileSync("git", ["cat-file", "-e", `${ref}^{commit}`], {
      cwd,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
};

/** `lockfileSites` for `bun.lock` at `base` against `head`. */
const baseLockfileSites = (
  base: string,
  head: string,
  root: string,
  sites: readonly string[]
): readonly string[] | undefined => {
  try {
    const before = execFileSync("git", ["show", `${base}:bun.lock`], {
      cwd: root,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const after = execFileSync("git", ["show", `${head}:bun.lock`], {
      cwd: root,
      encoding: "utf-8",
    });
    return lockfileSites(
      decodeEntries(Bun.JSONC.parse(before)),
      decodeEntries(Bun.JSONC.parse(after)),
      sites
    );
  } catch {
    return undefined;
  }
};

const sitesAt = (root: string, ref: string): readonly string[] =>
  execFileSync("git", ["ls-tree", "-r", "--name-only", ref, "--", "apps"], {
    cwd: root,
    encoding: "utf-8",
  })
    .split("\n")
    .flatMap(
      (file) =>
        /^apps\/(?<site>[^/]+)\/alchemy\.run\.ts$/u.exec(file)?.groups?.site ??
        []
    );

if (import.meta.main) {
  const started = performance.now();
  const pathsOnly = process.argv.includes("--paths-only");
  const [base = "origin/main", head = "HEAD"] = process.argv
    .slice(2)
    .filter((argument) => argument !== "--paths-only");
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf-8",
  }).trim();
  const sites = sitesAt(root, head);
  if (isCommit(base, root)) {
    // Exact endpoints also preserve push-to-main semantics: base=event.before,
    // not merge-base. On PRs HEAD is GitHub's tested merge with the current base.
    const changed = execFileSync("git", ["diff", "--name-only", base, head], {
      cwd: root,
      encoding: "utf-8",
    })
      .split("\n")
      .filter((line) => line !== "");
    const scope = changed.includes("bun.lock")
      ? baseLockfileSites(base, head, root, sites)
      : undefined;
    const candidates = affectedSites(changed, sites, scope);
    const comparable = pathsOnly
      ? []
      : comparisonSites(
          changed,
          candidates.deploy,
          new Set(sitesAt(root, base))
        );
    const fingerprints = await compareRevisionFingerprints(
      root,
      base,
      head,
      comparable
    );
    const affected = affectedSites(changed, sites, scope, fingerprints);
    process.stdout.write(outputLines(affected));
  } else {
    process.stderr.write(
      `base ${base} is not a commit here; every site is affected\n`
    );
    process.stdout.write(outputLines({ deploy: sites, verify: sites }));
  }
  process.stderr.write(
    `affected selection finished in ${((performance.now() - started) / 1000).toFixed(1)}s\n`
  );
}
