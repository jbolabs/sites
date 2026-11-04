/**
 * Applies EmDash's core migrations to a deployed site's D1 from CI, so no
 * visitor or smoke request runs them. A request that reaches a fresh Worker
 * first (a cron tick, a crawler) can still start them, and if it is cut off it
 * leaves EmDash's migration lock held for good: this waits out a live lock and
 * releases a dead one. Uses the job's `CLOUDFLARE_API_TOKEN` and
 * `CLOUDFLARE_ACCOUNT_ID`.
 */
import { execFileSync } from "node:child_process";

import { Schema } from "effect";

const Status = Schema.fromJsonString(
  Schema.Struct({
    lock: Schema.optional(
      Schema.Struct({ heldSince: Schema.String, id: Schema.String })
    ),
    target: Schema.Struct({ fingerprint: Schema.String }),
  })
);

/** A Worker cron invocation can run 15 minutes; a lock older than that has no live holder. */
export const STALE_LOCK_MS = 15 * 60_000;
const LOCK_POLL_MS = 15_000;

type LockStep =
  | { readonly kind: "apply" }
  | { readonly kind: "wait" }
  | { readonly kind: "release"; readonly id: string };

export const lockStep = (
  lock: { readonly heldSince: string; readonly id: string } | undefined,
  now: number
): LockStep => {
  if (lock === undefined) {
    return { kind: "apply" };
  }
  return now - Date.parse(lock.heldSince) >= STALE_LOCK_MS
    ? { id: lock.id, kind: "release" }
    : { kind: "wait" };
};

const sleep = (ms: number) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const emdashMigrate = (
  directory: string,
  env: NodeJS.ProcessEnv,
  args: readonly string[]
) =>
  execFileSync("bunx", ["emdash", "migrate", "--from-config", ...args], {
    cwd: directory,
    encoding: "utf-8",
    env,
    stdio: ["ignore", "pipe", "inherit"],
  });

export const migrateDatabase = (
  directory: string,
  databaseId: string,
  env: NodeJS.ProcessEnv
) => {
  const status = () =>
    Schema.decodeUnknownSync(Status)(
      emdashMigrate(directory, env, ["--status", "--json", "--d1", databaseId])
    );
  let { lock, target } = status();
  for (
    let step = lockStep(lock, Date.now());
    step.kind !== "apply";
    step = lockStep(lock, Date.now())
  ) {
    if (step.kind === "release") {
      process.stdout.write(
        `Releasing a dead migration lock held since ${lock?.heldSince}\n`
      );
      emdashMigrate(directory, env, [
        "--d1",
        databaseId,
        "--release-lock",
        step.id,
        "--expected-target-fingerprint",
        target.fingerprint,
      ]);
    } else {
      process.stdout.write(
        `Waiting for the migration lock held since ${lock?.heldSince}\n`
      );
      sleep(LOCK_POLL_MS);
    }
    ({ lock, target } = status());
  }
  process.stdout.write(
    emdashMigrate(directory, env, [
      "--d1",
      databaseId,
      "--expected-target-fingerprint",
      target.fingerprint,
    ])
  );
};
