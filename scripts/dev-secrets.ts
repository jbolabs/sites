/**
 * Runs a command with the `sites-dev` Infisical project's `dev` secrets in its
 * environment, so agents need no `.env` file:
 *
 *   bun run secrets -- bun run app -- start
 *
 * The project comes from the committed `.infisical.json` (the one place its id
 * lives). Credentials, in order: an existing `INFISICAL_TOKEN`, a machine
 * identity login from `INFISICAL_CLIENT_ID`/`INFISICAL_CLIENT_SECRET` (agents),
 * or the operator's `infisical login` session. The token is passed to the
 * child only through the environment and never printed. Values injected here
 * override the main checkout's `.env`, because `siteSecrets()` reads the
 * process environment last.
 *
 * Dev only: `sites-dev` never holds preview or prod values (see docs/stack.md).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { Schema } from "effect";

const InfisicalConfig = Schema.Struct({
  defaultEnvironment: Schema.Literal("dev"),
  workspaceId: Schema.String,
});

const root = path.resolve(import.meta.dirname, "..");

const config = Schema.decodeUnknownSync(InfisicalConfig)(
  JSON.parse(readFileSync(path.join(root, ".infisical.json"), "utf-8"))
);

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
      `--projectId=${config.workspaceId}`,
      `--env=${config.defaultEnvironment}`,
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
