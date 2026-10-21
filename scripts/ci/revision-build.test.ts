import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { comparisonBuildInputs, revisionPair } from "./revision-build.ts";

describe(revisionPair, () => {
  it("freezes caller-relative HEAD refs before a comparison checkout moves HEAD", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "fingerprint-ref-"));
    const env = {
      ...process.env,
      GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
      GIT_AUTHOR_EMAIL: "test@example.invalid",
      GIT_AUTHOR_NAME: "Fingerprint Test",
      GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
      GIT_COMMITTER_EMAIL: "test@example.invalid",
      GIT_COMMITTER_NAME: "Fingerprint Test",
    };
    const git = (args: readonly string[], input?: string) =>
      execFileSync("git", args, {
        cwd: root,
        encoding: "utf-8",
        env,
        input,
      }).trim();
    try {
      git(["init", "--quiet", "--object-format=sha1", "--initial-branch=main"]);
      const blob = git(["hash-object", "-w", "--stdin"], "before\n");
      const tree = git(["mktree"], `100644 blob ${blob}\thello.txt\n`);
      const base = git(["commit-tree", tree], "base\n");
      const head = git(["commit-tree", tree, "-p", base], "head\n");
      git(["update-ref", "HEAD", head]);
      const revisions = revisionPair(root, "HEAD~1", "HEAD");
      git(["update-ref", "HEAD", base]);
      expect(revisions).toStrictEqual({
        base: "97e715d36e5c6d48c7c1b09f8969aca7f05d625a",
        head: "fc05f68bc9c59890a2f77c54cf210a5ef327c18e",
      });
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });
});

describe(comparisonBuildInputs, () => {
  it("activates production-only email while preserving the prepared CI inputs", () => {
    expect(
      comparisonBuildInputs({
        contentDigest: "seed",
        seedMediaBase: "https://example.com/media",
      })
    ).toStrictEqual({
      contentDigest: "seed",
      emailFrom: "fingerprint@example.invalid",
      emailFromName: "CI fingerprint",
      seedMediaBase: "https://example.com/media",
    });
  });
});
