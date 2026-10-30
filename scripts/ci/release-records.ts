/**
 * Main's release ledger: one GitHub deployment per site and stage, marked
 * `in_progress` before Alchemy runs and `success` or `failure` after hosted
 * verification. A site whose latest release on either stage is not `success`
 * is released again on the next run, so a failed deploy retries even when the
 * fix lands outside `apps/<site>/`. Sites with no record have never released
 * through the ledger and are left to change detection.
 *
 *   bun scripts/ci/release-records.ts plan --sites '["a"]'    # prints sites=[…] (requested + unresolved)
 *   bun scripts/ci/release-records.ts start --stage staging   # records SITES as in_progress
 *   bun scripts/ci/release-records.ts finish --state success  # closes what start recorded
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

/** One page of a GET: `per_page=1` must not page through the whole history. */
export type GitHubGet = (route: string) => string;
const githubGet: GitHubGet = (route) =>
  execFileSync("gh", ["api", route], { encoding: "utf-8" });

/** The state of a site's latest release on a stage; `undefined` when it never released. */
export const latestRelease = (
  get: GitHubGet,
  repository: string,
  stage: ReleaseStage,
  site: string
): string | undefined => {
  // GitHub lists deployments newest first.
  const [latest] = Schema.decodeUnknownSync(page(Id))(
    get(
      `repos/${repository}/deployments?environment=${RELEASE_ENVIRONMENTS[stage]}&task=${releaseTask(site)}&per_page=1`
    )
  );
  if (latest === undefined) {
    return undefined;
  }
  const [status] = Schema.decodeUnknownSync(page(Status))(
    get(`repos/${repository}/deployments/${latest.id}/statuses?per_page=1`)
  );
  // A record without a status is an attempt whose job died before finishing.
  return status?.state ?? "pending";
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
      return state !== undefined && state !== "success";
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
  sha: string
): number => {
  if (!/^[a-f0-9]{40}$/u.test(sha)) {
    throw new Error("A release record requires an exact commit");
  }
  const { id } = Schema.decodeUnknownSync(Schema.fromJsonString(Id))(
    api(`repos/${repository}/deployments`, {
      auto_merge: false,
      environment: RELEASE_ENVIRONMENTS[stage],
      payload: { kind: "release-v1", site, stage },
      production_environment: stage === "prod",
      ref: sha,
      required_contexts: [],
      task: releaseTask(site),
      transient_environment: false,
    })
  );
  finishRelease(api, repository, id, "in_progress");
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
      (stage, site) => latestRelease(githubGet, repository, stage, site),
      process.env.EVENT === "workflow_dispatch"
    );
    process.stdout.write(`sites=${JSON.stringify(sites)}\n`);
  } else if (command === "start") {
    const stage = flag("--stage");
    if (stage !== "staging" && stage !== "prod") {
      throw new Error("--stage must be staging or prod");
    }
    const requested = Schema.decodeUnknownSync(SiteList)(
      process.env.SITES ?? "[]"
    );
    // Record exactly what deploy.ts will release on this stage (prod skips domainless sites).
    const sites = deploymentSites(
      await loadDeploymentSites(root, requested),
      stage
    );
    const ids = sites.map((site) =>
      startRelease(
        githubApi,
        repository,
        stage,
        site,
        process.env.GITHUB_SHA ?? ""
      )
    );
    mkdirSync(path.dirname(RECORDS_FILE), { recursive: true });
    writeFileSync(RECORDS_FILE, JSON.stringify(ids));
  } else if (command === "finish") {
    const state = flag("--state");
    if (state !== "success" && state !== "failure") {
      throw new Error("--state must be success or failure");
    }
    const ids = existsSync(RECORDS_FILE)
      ? Schema.decodeUnknownSync(Records)(readFileSync(RECORDS_FILE, "utf-8"))
      : [];
    for (const id of ids) {
      finishRelease(githubApi, repository, id, state);
    }
  } else {
    throw new Error("Usage: release-records.ts plan|start|finish");
  }
}
