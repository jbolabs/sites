/**
 * Prepares a new git worktree (run by T3 Code via `t3.json` and by lefthook's
 * `post-checkout`): installs dependencies. Secrets need no per-worktree setup:
 * stacks read Infisical through the Alchemy profile (docs/stack.md "Secrets").
 *
 *   bun run setup:worktree
 */
import { execFileSync } from "node:child_process";

if (import.meta.main) {
  const worktree = execFileSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf-8",
  }).trim();
  execFileSync("bun", ["install", "--frozen-lockfile"], {
    cwd: worktree,
    stdio: "inherit",
  });
}
