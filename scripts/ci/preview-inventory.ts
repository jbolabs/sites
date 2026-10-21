/** Persist stack revisions before deploy, including attempts that only partly succeed. */
import { execFileSync } from "node:child_process";

import { Schema } from "effect";

const Site = Schema.String.check(Schema.isPattern(/^[a-z][a-z0-9-]*$/u));
const Revision = Schema.String.check(Schema.isPattern(/^[a-f0-9]{40}$/u));
export const PreviewStack = Schema.Struct({ revision: Revision, site: Site });
const Inventory = Schema.Struct({
  stacks: Schema.Array(PreviewStack),
  stage: Schema.String,
});
const Comments = Schema.Array(
  Schema.Array(
    Schema.Struct({
      body: Schema.String,
      id: Schema.Number,
      user: Schema.Struct({ login: Schema.String }),
    })
  )
);
const MARKER = "<!-- preview-stack-inventory\n";
export type PreviewStack = typeof PreviewStack.Type;

export const mergePreviewStacks = (
  previous: readonly PreviewStack[],
  next: readonly PreviewStack[]
): readonly PreviewStack[] =>
  [
    ...new Map(
      [...previous, ...next].map((stack) => [stack.site, stack])
    ).values(),
  ].toSorted((a, b) => a.site.localeCompare(b.site));

const gh = (args: readonly string[]) =>
  execFileSync("gh", args, { encoding: "utf-8" });

const inventoryComment = (repository: string, pr: string) =>
  Schema.decodeUnknownSync(Schema.fromJsonString(Comments))(
    gh([
      "api",
      `repos/${repository}/issues/${pr}/comments`,
      "--paginate",
      "--slurp",
    ])
  )
    .flat()
    .find(
      ({ body, user }) =>
        user.login === "github-actions[bot]" && body.startsWith(MARKER)
    );

export const previewStacks = (
  body: string | undefined,
  stage: string
): readonly PreviewStack[] => {
  if (body === undefined) {
    return [];
  }
  if (!body.startsWith(MARKER) || !body.endsWith("\n-->")) {
    throw new Error("Invalid preview inventory");
  }
  const inventory = Schema.decodeUnknownSync(Schema.fromJsonString(Inventory))(
    body.slice(MARKER.length, -4)
  );
  if (inventory.stage !== stage) {
    throw new Error("Preview inventory stage mismatch");
  }
  return inventory.stacks;
};

export const readPreviewStacks = (repository: string, pr: string) =>
  previewStacks(inventoryComment(repository, pr)?.body, `pr-${pr}`);

if (import.meta.main) {
  const pr = process.env.PR ?? "";
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  if (!/^[1-9]\d*$/u.test(pr) || !/^[\w.-]+\/[\w.-]+$/u.test(repository)) {
    throw new Error("PR and GITHUB_REPOSITORY are required");
  }
  const sites = Schema.decodeUnknownSync(
    Schema.fromJsonString(Schema.Array(Site))
  )(process.env.SITES ?? "");
  const revision = Schema.decodeUnknownSync(Revision)(
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf-8" }).trim()
  );
  const stage = `pr-${pr}`;
  const existing = inventoryComment(repository, pr);
  const stacks = mergePreviewStacks(
    previewStacks(existing?.body, stage),
    sites.map((site) => ({ revision, site }))
  );
  const body = `${MARKER}${JSON.stringify({ stacks, stage })}\n-->`;
  gh(
    existing === undefined
      ? [
          "api",
          `repos/${repository}/issues/${pr}/comments`,
          "-f",
          `body=${body}`,
        ]
      : [
          "api",
          "--method",
          "PATCH",
          `repos/${repository}/issues/comments/${existing.id}`,
          "-f",
          `body=${body}`,
        ]
  );
}
