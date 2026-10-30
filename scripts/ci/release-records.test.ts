import { describe, expect, it } from "vitest";

import type { GitHubApi, GitHubRequest } from "./client-preview-records.ts";
import { latestRelease, releasePlan, startRelease } from "./release-records.ts";
import type { GitHubGet } from "./release-records.ts";

const SHA = "a".repeat(40);
/** A release whose job died before writing any status. */
const unfinished: GitHubGet = (route) =>
  route.includes("/statuses") ? "[]" : JSON.stringify([{ id: 7 }]);

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
        : JSON.stringify([{ id: 7 }]);
    };
    expect(latestRelease(api, "o/r", "prod", "ani-wenger")).toBe("failure");
    expect(routes).toStrictEqual([
      "repos/o/r/deployments?environment=production&task=release:ani-wenger&per_page=1",
      "repos/o/r/deployments/7/statuses?per_page=1",
    ]);
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
    expect(startRelease(api, "o/r", "prod", "ani-wenger", SHA)).toBe(42);
    expect(bodies).toStrictEqual([
      {
        auto_merge: false,
        environment: "production",
        payload: { kind: "release-v1", site: "ani-wenger", stage: "prod" },
        production_environment: true,
        ref: SHA,
        required_contexts: [],
        task: "release:ani-wenger",
        transient_environment: false,
      },
      { auto_inactive: false, state: "in_progress" },
    ]);
  });
});
