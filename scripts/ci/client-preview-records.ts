/** GitHub deployment records survive partial cloud deploys and branch/app deletion. */
import { execFileSync } from "node:child_process";

import { Schema } from "effect";

export const PreviewPayload = Schema.Struct({
  kind: Schema.Literal("client-preview-v1"),
  pull: Schema.Number,
  sites: Schema.Array(Schema.String),
});
export type PreviewPayload = typeof PreviewPayload.Type;
const Deployment = Schema.Struct({
  id: Schema.Number,
  payload: PreviewPayload,
});
export type PreviewRecord = typeof Deployment.Type;
const Status = Schema.Struct({ state: Schema.String });
/** Main's per-site release records (`release-records.ts`). */
export interface ReleasePayload {
  readonly kind: "release-v1";
  readonly site: string;
  readonly stage: string;
}
const DEPLOYMENT_STATES = [
  "success",
  "inactive",
  "in_progress",
  "failure",
] as const;
export type DeploymentState = (typeof DEPLOYMENT_STATES)[number];
export type GitHubRequest =
  | {
      auto_merge: false;
      environment: string;
      payload: PreviewPayload | ReleasePayload;
      production_environment: boolean;
      ref: string;
      required_contexts: readonly string[];
      task: string;
      transient_environment: boolean;
    }
  | { auto_inactive: false; state: DeploymentState };

/** GET returns paginated JSON arrays; callers decode the response for each endpoint. */
export type GitHubApi = (route: string, body?: GitHubRequest) => string;
export const githubApi: GitHubApi = (route, body) =>
  execFileSync(
    "gh",
    body === undefined
      ? ["api", "--paginate", "--slurp", route]
      : ["api", "--method", "POST", route, "--input", "-"],
    {
      encoding: "utf-8",
      input: body === undefined ? undefined : JSON.stringify(body),
    }
  );

export const clientStage = (pull: number): string => {
  if (!Number.isSafeInteger(pull) || pull <= 0) {
    throw new Error("Invalid preview PR number");
  }
  return `client-pr-${pull}`;
};

export const teardownIdentity = (site: string, stage: string) => {
  if (
    !/^[a-z][a-z0-9-]*$/u.test(site) ||
    !/^client-pr-[1-9]\d*$/u.test(stage)
  ) {
    throw new Error("Teardown is restricted to a client PR preview site/stage");
  }
  return { site, stage };
};

export const recordPreview = (
  api: GitHubApi,
  repository: string,
  pull: number,
  sites: readonly string[],
  sha: string
): number => {
  const stage = clientStage(pull);
  if (!/^[a-f0-9]{40}$/u.test(sha) || sites.length === 0) {
    throw new Error(
      "Preview ownership requires an exact commit and at least one site"
    );
  }
  for (const site of sites) {
    teardownIdentity(site, stage);
  }
  const payload: PreviewPayload = { kind: "client-preview-v1", pull, sites };
  const created = api(`repos/${repository}/deployments`, {
    auto_merge: false,
    environment: "client-preview-inventory",
    payload,
    production_environment: false,
    ref: sha,
    required_contexts: [],
    task: "client-preview",
    transient_environment: true,
  });
  return Schema.decodeUnknownSync(
    Schema.fromJsonString(Schema.Struct({ id: Schema.Number }))
  )(created).id;
};

export const activePreviews = (
  api: GitHubApi,
  repository: string,
  pull?: number
): PreviewRecord[] => {
  if (pull !== undefined) {
    clientStage(pull);
  }
  const pages = Schema.decodeUnknownSync(
    Schema.fromJsonString(Schema.Array(Schema.Array(Deployment)))
  )(
    api(
      `repos/${repository}/deployments?task=client-preview&environment=client-preview-inventory&per_page=100`
    )
  );
  return pages.flat().filter((record) => {
    const stage = clientStage(record.payload.pull);
    for (const site of record.payload.sites) {
      teardownIdentity(site, stage);
    }
    // Filter only after validating ownership, but before loading unrelated histories.
    if (pull !== undefined && record.payload.pull !== pull) {
      return false;
    }
    const statuses = Schema.decodeUnknownSync(
      Schema.fromJsonString(Schema.Array(Schema.Array(Status)))
    )(
      api(`repos/${repository}/deployments/${record.id}/statuses?per_page=100`)
    ).flat();
    // No status (or a failed attempt) still owns potentially partial Alchemy state.
    return statuses[0]?.state !== "inactive";
  });
};

export const previewStatus = (
  api: GitHubApi,
  repository: string,
  id: number,
  state: "success" | "inactive"
): void => {
  api(`repos/${repository}/deployments/${id}/statuses`, {
    auto_inactive: false,
    state,
  });
};

if (import.meta.main) {
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  if (process.argv.includes("--success")) {
    previewStatus(
      githubApi,
      repository,
      Number(process.env.DEPLOYMENT_ID),
      "success"
    );
  } else {
    const pull = Number(process.env.PR);
    const sites = Schema.decodeUnknownSync(
      Schema.fromJsonString(Schema.Array(Schema.String))
    )(process.env.SITES ?? "[]");
    const id = recordPreview(
      githubApi,
      repository,
      pull,
      sites,
      process.env.EXPECTED_HEAD ?? ""
    );
    process.stdout.write(`deployment=${id}\n`);
  }
}
