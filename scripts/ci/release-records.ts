/**
 * Main's release ledger: one GitHub deployment per site and stage, marked
 * `in_progress` before Alchemy runs and `success` or `failure` after hosted
 * verification. A site whose latest release on either stage is not `success`
 * is released again on the next run, so a failed deploy retries even when the
 * fix lands outside `apps/<site>/`. Sites with no record have never released
 * through the ledger and are left to change detection. Staging also queues the
 * prod records, so a production job that never starts still leaves a retry.
 *
 *   bun scripts/ci/release-records.ts plan --sites '["a"]'    # prints sites=[…] (requested + unresolved)
 *   bun scripts/ci/release-records.ts start                   # SITES: staging in_progress, prod queued; prints prod_records=[…]
 *   bun scripts/ci/release-records.ts mark --state in_progress   # RECORDS (or start's file)
 *   bun scripts/ci/release-records.ts finish --state success  # RECORDS (or start's file)
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { listSites } from "@jakebodea/control-app/site";
import { Schema } from "effect";

import { githubApi } from "./client-preview-records.ts";
import type { DeploymentState, GitHubApi } from "./client-preview-records.ts";
import { deploymentSites, loadDeploymentSites } from "./deployment-sites.ts";

/** The deploy jobs' own GitHub environments, so the ledger creates no new ones. */
export const RELEASE_ENVIRONMENTS = {
  prod: "production",
  staging: "staging",
} as const;
export type ReleaseStage = keyof typeof RELEASE_ENVIRONMENTS;

const releaseTask = (site: string) => {
  if (!/^[a-z][a-z0-9-]*$/u.test(site)) {
    throw new Error(`Invalid site name "${site}"`);
  }
  return `release:${site}`;
};

const Id = Schema.Struct({ id: Schema.Number });
const page = <S extends Schema.Top>(item: S) =>
  Schema.fromJsonString(Schema.Array(item));
const Status = Schema.Struct({ state: Schema.String });
const Release = Schema.Struct({
  id: Schema.Number,
  payload: Schema.Struct({ run: Schema.optional(Schema.Number) }),
});
const Run = Schema.fromJsonString(Schema.Struct({ status: Schema.String }));
/** A queued or running release whose workflow run is still going: not a failure yet. */
export const IN_FLIGHT = "in_flight";

/**
 * One page of a GET (`per_page=1` must not page through the whole history);
 * `NOT_FOUND` (an empty body) when GitHub answers 404. Other API errors throw.
 */
export type GitHubGet = (route: string) => string;
export const NOT_FOUND = "";
const githubGet: GitHubGet = (route) => {
  try {
    return execFileSync("gh", ["api", route], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("(HTTP 404)")) {
      return NOT_FOUND;
    }
    throw error;
  }
};

/**
 * The state of a site's latest release on a stage; `undefined` when it never
 * released, `IN_FLIGHT` while the run that recorded it is still going.
 */
export const latestRelease = (
  get: GitHubGet,
  repository: string,
  stage: ReleaseStage,
  site: string,
  /** This run's id: its own records (a rerun keeps the id) are never in flight. */
  currentRun?: number
): string | undefined => {
  // GitHub lists deployments newest first.
  const [latest] = Schema.decodeUnknownSync(page(Release))(
    get(
      `repos/${repository}/deployments?environment=${RELEASE_ENVIRONMENTS[stage]}&task=${releaseTask(site)}&per_page=1`
    )
  );
  if (latest === undefined) {
    return undefined;
  }
  const statuses = Schema.decodeUnknownSync(page(Status))(
    get(`repos/${repository}/deployments/${latest.id}/statuses?per_page=10`)
  );
  // GitHub's own deployment for a job in the same environment adds `inactive`
  // on top of an earlier `success`, and drops statuses after 90 days, so only
  // `inactive` may be left: that release succeeded and was superseded. A record
  // without a status is an attempt that died before its first status.
  const state =
    statuses.length === 0
      ? "pending"
      : (statuses.find((status) => status.state !== "inactive")?.state ??
        "success");
  // Another push can plan while an earlier run's prod release is still queued.
  const { run } = latest.payload;
  if (
    state === "success" ||
    state === "failure" ||
    run === undefined ||
    run === currentRun
  ) {
    return state;
  }
  // A deleted run (404) has finished for good: retry what it left unresolved.
  const recorder = get(`repos/${repository}/actions/runs/${run}`);
  return recorder !== NOT_FOUND &&
    Schema.decodeUnknownSync(Run)(recorder).status !== "completed"
    ? IN_FLIGHT
    : state;
};

/**
 * Requested sites plus every site whose latest release on either stage did not
 * succeed. A prod-only failure re-releases staging too: prod ships only what
 * staging just verified (ADR 0009). A dispatch releases exactly what it names:
 * its verification checked only those sites.
 */
export const releasePlan = (
  requested: readonly string[],
  candidates: {
    readonly staging: readonly string[];
    readonly prod: readonly string[];
  },
  latest: (stage: ReleaseStage, site: string) => string | undefined,
  dispatch = false
): readonly string[] => {
  if (dispatch) {
    return [...new Set(requested)].toSorted();
  }
  const unresolved = (["staging", "prod"] as const).flatMap((stage) =>
    candidates[stage].filter((site) => {
      const state = latest(stage, site);
      return state !== undefined && state !== "success" && state !== IN_FLIGHT;
    })
  );
  return [...new Set([...requested, ...unresolved])].toSorted();
};

export const finishRelease = (
  api: GitHubApi,
  repository: string,
  id: number,
  state: Exclude<DeploymentState, "inactive">
): void => {
  api(`repos/${repository}/deployments/${id}/statuses`, {
    // Each site keeps its own record; never let one release mark another inactive.
    auto_inactive: false,
    state,
  });
};

export const startRelease = (
  api: GitHubApi,
  repository: string,
  stage: ReleaseStage,
  site: string,
  sha: string,
  run: number,
  initial: "in_progress" | "queued" = "in_progress"
): number => {
  if (!/^[a-f0-9]{40}$/u.test(sha)) {
    throw new Error("A release record requires an exact commit");
  }
  const { id } = Schema.decodeUnknownSync(Schema.fromJsonString(Id))(
    api(`repos/${repository}/deployments`, {
      auto_merge: false,
      environment: RELEASE_ENVIRONMENTS[stage],
      payload: { kind: "release-v1", run, site, stage },
      production_environment: stage === "prod",
      ref: sha,
      required_contexts: [],
      task: releaseTask(site),
      transient_environment: false,
    })
  );
  finishRelease(api, repository, id, initial);
  return id;
};

const RECORDS_FILE = path.join(".artifacts", "ci", "release-records.json");
const Records = Schema.fromJsonString(Schema.Array(Schema.Number));
const SiteList = Schema.fromJsonString(Schema.Array(Schema.String));

const flag = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

if (import.meta.main) {
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  const root = path.resolve(import.meta.dirname, "../..");
  const command = process.argv.at(2);
  if (command === "plan") {
    const configured = await loadDeploymentSites(root, listSites(root));
    const sites = releasePlan(
      Schema.decodeUnknownSync(SiteList)(flag("--sites") ?? "[]"),
      {
        prod: deploymentSites(configured, "prod"),
        staging: deploymentSites(configured, "staging"),
      },
      (stage, site) =>
        latestRelease(
          githubGet,
          repository,
          stage,
          site,
          Number(process.env.GITHUB_RUN_ID)
        ),
      process.env.EVENT === "workflow_dispatch"
    );
    process.stdout.write(`sites=${JSON.stringify(sites)}\n`);
  } else if (command === "start") {
    const requested = await loadDeploymentSites(
      root,
      Schema.decodeUnknownSync(SiteList)(process.env.SITES ?? "[]")
    );
    const sha = process.env.GITHUB_SHA ?? "";
    const run = Number(process.env.GITHUB_RUN_ID);
    // Record exactly what deploy.ts releases on each stage (prod skips domainless sites).
    const staging = deploymentSites(requested, "staging").map((site) =>
      startRelease(githubApi, repository, "staging", site, sha, run)
    );
    const prod = deploymentSites(requested, "prod").map((site) =>
      startRelease(githubApi, repository, "prod", site, sha, run, "queued")
    );
    mkdirSync(path.dirname(RECORDS_FILE), { recursive: true });
    writeFileSync(RECORDS_FILE, JSON.stringify(staging));
    process.stdout.write(`prod_records=${JSON.stringify(prod)}\n`);
  } else if (command === "mark" || command === "finish") {
    const state = flag("--state");
    if (state !== "success" && state !== "failure" && state !== "in_progress") {
      throw new Error("--state must be in_progress, success or failure");
    }
    // An unset or empty output means "use start's file", never an empty decode.
    const records = process.env.RECORDS ?? "";
    const fromFile = existsSync(RECORDS_FILE)
      ? readFileSync(RECORDS_FILE, "utf-8")
      : "[]";
    const ids = Schema.decodeUnknownSync(Records)(
      records === "" ? fromFile : records
    );
    for (const id of ids) {
      finishRelease(githubApi, repository, id, state);
    }
  } else {
    throw new Error("Usage: release-records.ts plan|start|mark|finish");
  }
}
