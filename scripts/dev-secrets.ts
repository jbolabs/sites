/**
 * Runs a non-Alchemy command with `sites-dev` (env `dev`) in its process
 * environment:
 *
 *   bun run secrets -- bun run app -- start --content prod
 *
 * Alchemy stacks never need this: they read Infisical themselves
 * (`stageSecrets` in cloudflare-kit). It exists for plain Bun/CLI consumers that
 * read `process.env`: the control app's production-content fetch
 * (`PUBLISHED_CONTENT_EXPORT_TOKEN`) and, optionally, Turborepo's remote cache
 * (`TURBO_*`).
 *
 * Credentials, in order: an existing `INFISICAL_TOKEN`, a machine identity
 * login from `INFISICAL_CLIENT_ID`/`INFISICAL_CLIENT_SECRET` (agents), or the
 * operator's `infisical login` session. The token reaches the child only through
 * the environment and is never printed. `infisical run` reports any child
 * failure as exit code 1.
 */
import { execFileSync, spawnSync } from "node:child_process";

import { infisical } from "../stacks/config.ts";

const envValue = (name: string): string | undefined => {
  const value = process.env[name];
  return value === undefined || value === "" ? undefined : value;
};

/** A machine identity token, when the agent environment carries one. */
const machineToken = (): string | undefined => {
  const existing = envValue("INFISICAL_TOKEN");
  if (existing !== undefined) {
    return existing;
  }
  const clientId = envValue("INFISICAL_CLIENT_ID");
  const clientSecret = envValue("INFISICAL_CLIENT_SECRET");
  if (clientId === undefined || clientSecret === undefined) {
    return undefined;
  }
  // Credentials go through the CLI's own env vars, not argv, so `ps` never shows them.
  return execFileSync(
    "infisical",
    ["login", "--method=universal-auth", "--silent", "--plain"],
    {
      encoding: "utf-8",
      env: {
        ...process.env,
        INFISICAL_UNIVERSAL_AUTH_CLIENT_ID: clientId,
        INFISICAL_UNIVERSAL_AUTH_CLIENT_SECRET: clientSecret,
      },
      stdio: ["ignore", "pipe", "inherit"],
    }
  ).trim();
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  const command = args[0] === "--" ? args.slice(1) : args;
  if (command.length === 0) {
    process.stderr.write("Usage: bun run secrets -- <command> [args...]\n");
    process.exit(2);
  }
  const token = machineToken();
  const result = spawnSync(
    "infisical",
    [
      "run",
      `--projectId=${infisical.projects.dev}`,
      "--env=dev",
      "--silent",
      "--",
      ...command,
    ],
    {
      env:
        token === undefined
          ? process.env
          : { ...process.env, INFISICAL_TOKEN: token },
      stdio: "inherit",
    }
  );
  if (result.error !== undefined) {
    throw result.error;
  }
  process.exit(result.status ?? 1);
}
