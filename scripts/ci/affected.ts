/**
 * Which sites a change touches, as two lists, because tooling can change how
 * a site is checked without changing what ships:
 *
 * - `verify`: sites whose required smoke, SEO and Lighthouse checks run.
 * - `deploy`: sites whose Worker could differ, so previews and prod redeploy them.
 *
 * A change inside `apps/<site>/` affects that site. Shared runtime code and
 * root config (packages, lockfile) affect every site, except a lockfile change
 * confined to sites' own workspace entries (adding a site, or a site taking a
 * catalog dependency another site already resolves), which affects only them.
 * The verification tooling re-verifies every site but deploys none. Tests,
 * docs and agent instructions affect none: tests run in `lint-test` and are
 * never bundled.
 *
 *   bun scripts/ci/affected.ts <base-ref>     # prints `verify=[…]` and `deploy=[…]` lines
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { listSites } from "@jakebodea/control-app/site";
import { Schema } from "effect";

export interface Affected {
  readonly deploy: readonly string[];
  readonly verify: readonly string[];
}

const SITE_PATH = /^apps\/(?<site>[^/]+)\//u;
/** Never built into a Worker nor run by a site's verification. */
const UNSHIPPED_PATHS = [/\.test\.tsx?$/u, /^packages\/proof\//u];
/** Checks every site (smoke, SEO, Lighthouse) but ships in none. */
export const VERIFY_TOOLING_PATHS = [
  /^packages\/control-app\//u,
  /^scripts\/ci\/.*\.ts$/u,
  /^\.github\/(?:workflows\/ci\.yml|actions\/setup\/action\.yml)$/u,
  /^lighthouserc\.json$/u,
];
const SHARED_PATHS = [
  /^packages\//u,
  /^bun\.lock$/u,
  /^package\.json$/u,
  /^turbo\.json$/u,
  /^tsconfig\.json$/u,
  /^bunfig\.toml$/u,
];

const matchesAny = (file: string, patterns: readonly RegExp[]) =>
  patterns.some((pattern) => pattern.test(file));

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
  lockfileScope?: readonly string[]
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
    (file) => !matchesAny(file, VERIFY_TOOLING_PATHS)
  );
  const touched = new Set(
    runtime.flatMap((file) => {
      const site = SITE_PATH.exec(file)?.groups?.site;
      return site === undefined ? [] : [site];
    })
  );
  const deploy = runtime.some((file) => matchesAny(file, SHARED_PATHS))
    ? [...sites]
    : sites.filter((site) => touched.has(site));
  return { deploy, verify: tooling.length > 0 ? [...sites] : deploy };
};

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

/** `lockfileSites` for `bun.lock` at `base` against the working tree's. */
const baseLockfileSites = (
  base: string,
  root: string,
  sites: readonly string[]
): readonly string[] | undefined => {
  let before: string;
  try {
    before = execFileSync("git", ["show", `${base}:bun.lock`], {
      cwd: root,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return undefined;
  }
  const after = readFileSync(path.join(root, "bun.lock"), "utf-8");
  return lockfileSites(
    decodeEntries(Bun.JSONC.parse(before)),
    decodeEntries(Bun.JSONC.parse(after)),
    sites
  );
};

if (import.meta.main) {
  const base = process.argv[2] ?? "origin/main";
  const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf-8",
  }).trim();
  const sites = listSites(root);
  // A branch's first push (base 000…0) or a force-push leaves no base to diff against:
  // treat everything as changed, as `turbo --affected` does.
  if (isCommit(base, root)) {
    const changed = execFileSync(
      "git",
      ["diff", "--name-only", `${base}...HEAD`],
      {
        cwd: root,
        encoding: "utf-8",
      }
    )
      .split("\n")
      .filter((line) => line !== "");
    process.stdout.write(
      outputLines(
        affectedSites(
          changed,
          sites,
          changed.includes("bun.lock")
            ? baseLockfileSites(base, root, sites)
            : undefined
        )
      )
    );
  } else {
    process.stderr.write(
      `base ${base} is not a commit here; every site is affected\n`
    );
    process.stdout.write(outputLines({ deploy: sites, verify: sites }));
  }
}
