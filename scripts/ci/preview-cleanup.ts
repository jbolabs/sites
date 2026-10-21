/** Main controls teardown; pinned PR stacks have the same trust as preview deploys. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { readPreviewStacks } from "./preview-inventory.ts";
import type { PreviewStack } from "./preview-inventory.ts";

const STACK_PATH = /^apps\/(?<site>[a-z][a-z0-9-]*)\/alchemy\.run\.ts$/u;

export const stackSites = (files: readonly string[]): readonly string[] =>
  [
    ...new Set(
      files.flatMap((file) => STACK_PATH.exec(file)?.groups?.site ?? [])
    ),
  ].toSorted();

/** Main covers deleted stacks; inventory recovers sites absent from both trees. */
export const cleanupSites = (
  mainFiles: readonly string[],
  headFiles: readonly string[],
  inventory: readonly PreviewStack[] = []
) => {
  const head = stackSites(headFiles);
  const main = stackSites(mainFiles).filter((site) => !head.includes(site));
  return {
    head,
    historical: inventory.filter(
      ({ site }) => !head.includes(site) && !main.includes(site)
    ),
    main,
  };
};

const trackedFiles = (directory: string) =>
  execFileSync("git", ["ls-tree", "-r", "--name-only", "HEAD", "--", "apps"], {
    cwd: directory,
    encoding: "utf-8",
  })
    .trim()
    .split("\n");

const destroySite = (directory: string, site: string, stage: string) => {
  execFileSync(
    "bun",
    ["alchemy", "destroy", "--stage", stage, "--yes", "--no-input"],
    {
      cwd: path.join(directory, "apps", site),
      env: Object.fromEntries(
        Object.entries(process.env).filter(([, value]) => value !== "")
      ),
      stdio: "inherit",
    }
  );
  process.stdout.write(`${site}: destroyed ${stage}\n`);
};

const destroyHistorical = (
  repository: string,
  { revision, site }: PreviewStack,
  stage: string
) => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), "preview-cleanup-"));
  try {
    const archive = execFileSync(
      "gh",
      ["api", `repos/${repository}/tarball/${revision}`],
      { maxBuffer: 256 * 1024 * 1024 }
    );
    const file = path.join(temporary, "source.tar.gz");
    writeFileSync(file, archive);
    execFileSync("tar", [
      "-xzf",
      file,
      "--strip-components=1",
      "-C",
      temporary,
    ]);
    execFileSync("bun", ["install", "--frozen-lockfile"], {
      cwd: temporary,
      stdio: "inherit",
    });
    destroySite(temporary, site, stage);
  } finally {
    rmSync(temporary, { force: true, recursive: true });
  }
};

if (import.meta.main) {
  const [headDirectory, stage] = process.argv.slice(2);
  if (
    headDirectory === undefined ||
    stage === undefined ||
    !/^pr-[1-9]\d*$/u.test(stage)
  ) {
    throw new Error("Usage: preview-cleanup.ts <PR-head-checkout> pr-<number>");
  }
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  if (!/^[\w.-]+\/[\w.-]+$/u.test(repository)) {
    throw new Error("GITHUB_REPOSITORY is required");
  }
  const root = path.resolve(import.meta.dirname, "../..");
  const head = path.resolve(headDirectory);
  const inventory = readPreviewStacks(repository, stage.slice(3));
  const sites = cleanupSites(trackedFiles(root), trackedFiles(head), inventory);
  for (const [directory, names] of [
    [head, sites.head],
    [root, sites.main],
  ] as const) {
    for (const site of names) {
      destroySite(directory, site, stage);
    }
  }
  // Inventory is written before deploying, so partial failures and force-pushes
  // cannot erase a removed site's last attempted stack revision.
  for (const stack of sites.historical) {
    destroyHistorical(repository, stack, stage);
  }
}
