import { execFileSync } from "node:child_process";
import path from "node:path";

import { Schema } from "effect";

import {
  activePreviews,
  clientStage,
  githubApi,
  previewStatus,
} from "./client-preview-records.ts";
import type { PreviewRecord } from "./client-preview-records.ts";
import { command } from "./command.ts";
import { previewPolicy } from "./preview-policy.ts";

/** Retries every recorded site, not merely Workers that finished deploying. */
export const retiredClientPreviews = (
  records: readonly PreviewRecord[],
  requestedPulls: ReadonlySet<number>
): { pull: number; sites: string[]; records: number[] }[] => {
  const pulls = [...new Set(records.map((record) => record.payload.pull))];
  return pulls
    .filter((pull) => !requestedPulls.has(pull))
    .map((pull) => {
      const owned = records.filter((record) => record.payload.pull === pull);
      return {
        pull,
        records: owned.map((record) => record.id),
        sites: [
          ...new Set(owned.flatMap((record) => record.payload.sites)),
        ].toSorted(),
      };
    });
};

export const reconcileClientPreviews = async (
  records: readonly PreviewRecord[],
  requested: ReadonlySet<number>,
  actions: {
    destroy: (site: string, stage: string) => Promise<void> | void;
    retireComment: (pull: number, stage: string) => Promise<void> | void;
    api: typeof githubApi;
    repository: string;
  }
): Promise<string[]> => {
  const retired: string[] = [];
  const failures: Error[] = [];
  for (const preview of retiredClientPreviews(records, requested)) {
    const stage = clientStage(preview.pull);
    try {
      for (const site of preview.sites) {
        await actions.destroy(site, stage);
      }
      await actions.retireComment(preview.pull, stage);
      for (const id of preview.records) {
        previewStatus(actions.api, actions.repository, id, "inactive");
      }
      retired.push(stage);
    } catch (error) {
      failures.push(new Error(`${stage}: ${String(error)}`));
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      failures.map((error) => error.message).join("; ")
    );
  }
  return retired;
};

if (import.meta.main) {
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  const root = path.resolve(import.meta.dirname, "../..");
  const selected = process.env.PR;
  const records = activePreviews(githubApi, repository).filter(
    (record) =>
      selected === undefined ||
      selected === "" ||
      record.payload.pull === Number(selected)
  );
  const requested = new Set<number>();
  const Pull = Schema.fromJsonString(
    Schema.Struct({
      headRefOid: Schema.String,
      labels: Schema.Array(Schema.Struct({ name: Schema.String })),
      state: Schema.Literals(["OPEN", "CLOSED", "MERGED"]),
    })
  );
  // This runs after the shared deploy/cleanup lock is acquired. API failures abort safely.
  for (const pull of new Set(records.map((record) => record.payload.pull))) {
    const current = Schema.decodeUnknownSync(Pull)(
      execFileSync(
        "gh",
        [
          "pr",
          "view",
          String(pull),
          "--repo",
          repository,
          "--json",
          "state,labels,headRefOid",
        ],
        { encoding: "utf-8" }
      )
    );
    if (!previewPolicy(current, undefined, "client-preview").destroy) {
      requested.add(pull);
    }
  }
  await reconcileClientPreviews(records, requested, {
    api: githubApi,
    destroy: async (site, stage) => {
      process.env.PREVIEW_SITE = site;
      await command(
        "bun",
        [
          "alchemy",
          "destroy",
          "scripts/ci/client-preview-destroy.alchemy.ts",
          "--stage",
          stage,
          "--yes",
          "--no-input",
        ],
        root
      );
    },
    repository,
    retireComment: async (pull, stage) => {
      await command(
        "bun",
        [
          "scripts/ci/comment.ts",
          "--pr",
          String(pull),
          "--stage",
          stage,
          "--retired",
        ],
        root
      );
    },
  });
}
