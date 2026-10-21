import { execFileSync } from "node:child_process";

import { Schema } from "effect";

const PullRequest = Schema.fromJsonString(
  Schema.Struct({
    headRefOid: Schema.String,
    labels: Schema.Array(Schema.Struct({ name: Schema.String })),
    state: Schema.Literals(["OPEN", "CLOSED", "MERGED"]),
  })
);

/** Queued jobs consult current PR state after acquiring the shared Alchemy stage lock. */
export const previewPolicy = (
  pull: typeof PullRequest.Type,
  expectedHead?: string,
  previewLabel: "preview" | "client-preview" = "preview"
) => {
  const requested =
    pull.state === "OPEN" &&
    pull.labels.some((label) => label.name === previewLabel);
  return {
    content: pull.labels.some((label) => label.name === "production-content")
      ? "prod"
      : "seed",
    deploy: requested && pull.headRefOid === expectedHead,
    destroy: !requested,
  };
};

if (import.meta.main) {
  const pr = process.env.PR ?? "";
  if (!/^[1-9]\d*$/u.test(pr)) {
    throw new Error("PR must be a positive pull request number");
  }
  const pull = Schema.decodeUnknownSync(PullRequest)(
    execFileSync(
      "gh",
      ["pr", "view", pr, "--json", "state,labels,headRefOid"],
      { encoding: "utf-8" }
    )
  );
  const label = process.env.PREVIEW_LABEL ?? "preview";
  if (label !== "preview" && label !== "client-preview") {
    throw new Error("Unsupported preview label");
  }
  const policy = previewPolicy(pull, process.env.EXPECTED_HEAD, label);
  process.stdout.write(
    `deploy=${policy.deploy}\ndestroy=${policy.destroy}\ncontent=${policy.content}\n`
  );
}
