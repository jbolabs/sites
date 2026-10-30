import { describe, expect, it } from "vitest";

import type { GitHubApi, GitHubRequest } from "./client-preview-records.ts";
import type { GitHubGet } from "./release-records.ts";
import {
  latestRelease,
  NOT_FOUND,
  releasePlan,
  startRelease,
} from "./release-records.ts";

const SHA = "a".repeat(40);
/** A release whose job died before writing any status. */
const unfinished: GitHubGet = (route) =>
  route.includes("/statuses") ? "[]" : JSON.stringify([{ id: 7, payload: {} }]);
/** A staging release that succeeded, then got the inactive status GitHub adds. */
const supersededByJob: GitHubGet = (route) =>
  route.includes("/statuses")
    ? JSON.stringify([
        { state: "inactive" },
        { state: "success" },
        { state: "in_progress" },
      ])
    : JSON.stringify([{ id: 7, payload: {} }]);
/** A succeeded release whose statuses expired, leaving GitHub's inactive. */
const expired: GitHubGet = (route) =>
  route.includes("/statuses")
    ? JSON.stringify([{ state: "inactive" }])
    : JSON.stringify([{ id: 7, payload: {} }]);
/** A queued prod release recorded by run 5, which is in `runStatus`. */
const queuedBy =
  (runStatus: string): GitHubGet =>
  (route) => {
    if (route.includes("/actions/runs/")) {
      return JSON.stringify({ status: runStatus });
    }
    return route.includes("/statuses")
      ? JSON.stringify([{ state: "queued" }])
      : JSON.stringify([{ id: 7, payload: { run: 5 } }]);
  };
/** A queued prod release recorded by run 5, which has since been deleted. */
const deletedRun: GitHubGet = (route) => {
  if (route.includes("/actions/runs/")) {
    return NOT_FOUND;
  }
  return route.includes("/statuses")
    ? JSON.stringify([{ state: "queued" }])
    : JSON.stringify([{ id: 7, payload: { run: 5 } }]);
};

describe(releasePlan, () => {
  const candidates = {
    prod: ["ani-wenger", "equityfast"],
    staging: ["ani-wenger", "equityfast", "ms-custom-homes"],
  };

  it("adds a site whose last prod release failed to an unrelated change", () => {
    const states = new Map([
      ["prod/ani-wenger", "failure"],
      ["prod/equityfast", "success"],
      ["staging/ani-wenger", "success"],
      ["staging/equityfast", "success"],
      ["staging/ms-custom-homes", "success"],
    ]);
    expect(
      releasePlan(["ms-custom-homes"], candidates, (stage, site) =>
        states.get(`${stage}/${site}`)
      )
    ).toStrictEqual(["ani-wenger", "ms-custom-homes"]);
  });

  it("releases exactly the dispatched sites, even with another site's release failed", () => {
    expect(
      releasePlan(["equityfast"], candidates, () => "failure", true)
    ).toStrictEqual(["equityfast"]);
  });

  it("leaves a release that another run is still carrying out", () => {
    expect(
      releasePlan([], candidates, (stage, site) =>
        stage === "prod" && site === "ani-wenger" ? "in_flight" : "success"
      )
    ).toStrictEqual([]);
  });

  it("retries a prod release that staging queued but production never started", () => {
    expect(
      releasePlan([], candidates, (stage, site) =>
        stage === "prod" && site === "ani-wenger" ? "queued" : "success"
      )
    ).toStrictEqual(["ani-wenger"]);
  });

  it("retries an attempt that never finished, and leaves sites with no record to change detection", () => {
    expect(
      releasePlan([], candidates, (stage, site) =>
        stage === "staging" && site === "equityfast" ? "in_progress" : undefined
      )
    ).toStrictEqual(["equityfast"]);
  });
});

describe(latestRelease, () => {
  it("reads the newest status of the site's newest release on that stage", () => {
    const routes: string[] = [];
    const api: GitHubGet = (route) => {
      routes.push(route);
      return route.includes("/statuses")
        ? JSON.stringify([{ state: "failure" }])
        : JSON.stringify([{ id: 7, payload: {} }]);
    };
    expect(latestRelease(api, "o/r", "prod", "ani-wenger")).toBe("failure");
    expect(routes).toStrictEqual([
      "repos/o/r/deployments?environment=production&task=release:ani-wenger&per_page=1",
      "repos/o/r/deployments/7/statuses?per_page=10",
    ]);
  });

  it("reads past the inactive status GitHub adds when the staging job's own deployment succeeds", () => {
    expect(latestRelease(supersededByJob, "o/r", "staging", "ani-wenger")).toBe(
      "success"
    );
  });

  it("treats a record with only GitHub's inactive status left as a superseded success", () => {
    expect(latestRelease(expired, "o/r", "staging", "ani-wenger")).toBe(
      "success"
    );
  });

  it("treats a queued prod release from a run that is still going as in flight, and one from a finished run as unresolved", () => {
    expect([
      latestRelease(queuedBy("in_progress"), "o/r", "prod", "ani-wenger"),
      latestRelease(queuedBy("completed"), "o/r", "prod", "ani-wenger"),
    ]).toStrictEqual(["in_flight", "queued"]);
  });

  it("retries a queued release whose run was deleted, and its own rerun's queued release", () => {
    expect([
      latestRelease(deletedRun, "o/r", "prod", "ani-wenger"),
      latestRelease(queuedBy("in_progress"), "o/r", "prod", "ani-wenger", 5),
    ]).toStrictEqual(["queued", "queued"]);
  });

  it("reports a record with no status as pending", () => {
    expect(latestRelease(unfinished, "o/r", "staging", "equityfast")).toBe(
      "pending"
    );
  });
});

describe(startRelease, () => {
  it("records the release in the stage's own environment, then marks it in progress", () => {
    const bodies: GitHubRequest[] = [];
    const api: GitHubApi = (_route, body) => {
      if (body !== undefined) {
        bodies.push(body);
      }
      return JSON.stringify({ id: 42 });
    };
    expect(
      startRelease(api, "o/r", "prod", "ani-wenger", SHA, 99, "queued")
    ).toBe(42);
    expect(bodies).toStrictEqual([
      {
        auto_merge: false,
        environment: "production",
        payload: {
          kind: "release-v1",
          run: 99,
          site: "ani-wenger",
          stage: "prod",
        },
        production_environment: true,
        ref: SHA,
        required_contexts: [],
        task: "release:ani-wenger",
        transient_environment: false,
      },
      { auto_inactive: false, state: "queued" },
    ]);
  });
});
