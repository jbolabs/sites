import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  new URL("../../.github/workflows/ci.yml", import.meta.url),
  "utf-8"
);

const job = (name: string) =>
  workflow.split(`\n  ${name}:\n`)[1]?.split(/\n {2}[a-z-]+:\n/u)[0] ?? "";

/** The `Diff base` step's shell script in `name`, unindented. */
const diffBaseScript = (name: string) =>
  (job(name).split("      - name: Diff base\n")[1] ?? "")
    .split("        run: |\n")[1]
    ?.split("        env:\n")[0]
    ?.replaceAll(/^ {10}/gmu, "") ?? "";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();

/** Runs `script` as GitHub would in `cwd` and returns what it wrote to `$GITHUB_OUTPUT`. */
const run = (script: string, cwd: string, env: Record<string, string>) => {
  const output = path.join(
    mkdtempSync(path.join(tmpdir(), "github-output-")),
    "out"
  );
  execFileSync("bash", ["-e", "-c", script], {
    cwd,
    env: { ...process.env, ...env, GITHUB_OUTPUT: output },
  });
  return readFileSync(output, "utf-8");
};

/**
 * A repo shaped like a PR checkout after main moved on: the PR branched from
 * `opened`, main then gained a commit, and HEAD is GitHub's merge of the PR
 * into today's main.
 */
const prCheckout = () => {
  const cwd = mkdtempSync(path.join(tmpdir(), "diff-base-"));
  git(cwd, "init", "-q", "-b", "main");
  git(cwd, "config", "user.email", "ci@example.com");
  git(cwd, "config", "user.name", "CI");
  git(cwd, "commit", "-q", "--allow-empty", "-m", "opened");
  git(cwd, "branch", "pr");
  git(cwd, "commit", "-q", "--allow-empty", "-m", "main moved");
  git(cwd, "checkout", "-q", "pr");
  git(cwd, "commit", "-q", "--allow-empty", "-m", "pr change");
  git(cwd, "checkout", "-q", "--detach", "main");
  git(cwd, "merge", "-q", "--no-ff", "-m", "merge pr into main", "pr");
  return cwd;
};

describe("CI diff base", () => {
  // `pull_request.base.sha` keeps the base a PR was opened on. Once main moves,
  // diffing GitHub's merge commit against it counts main's newer commits as the
  // PR's, so CI verified and previewed sites the PR never touched.
  it("diffs a PR against today's main, not the commit it branched from", () => {
    const cwd = prCheckout();
    const today = git(cwd, "rev-parse", "main");
    for (const name of ["affected", "deploy-scope", "lint-test"]) {
      expect(run(diffBaseScript(name), cwd, { EVENT: "pull_request" })).toBe(
        `sha=${today}\n`
      );
    }
    expect(git(cwd, "log", "-1", "--format=%s", today)).toBe("main moved");
  });

  it("diffs a push against the commit before it", () => {
    const cwd = prCheckout();
    expect(
      run(diffBaseScript("affected"), cwd, { BEFORE: "abc123", EVENT: "push" })
    ).toBe("sha=abc123\n");
  });

  it("feeds that base to site selection and Turborepo's affected filter", () => {
    const base = `\${{ steps.base.outputs.sha }}`;
    expect(job("affected")).toContain(`BASE: ${base}`);
    expect(job("deploy-scope")).toContain(`BASE: ${base}`);
    expect(job("lint-test")).toContain(`TURBO_SCM_BASE: ${base}`);
    expect(workflow).not.toContain("github.event.pull_request.base.sha");
  });
});
