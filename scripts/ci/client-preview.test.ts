import { describe, expect, it } from "vitest";

import {
  reconcileClientPreviews,
  retiredClientPreviews,
} from "./client-preview-cleanup.ts";
import type {
  GitHubRequest,
  GitHubApi,
  PreviewRecord,
} from "./client-preview-records.ts";
import {
  activePreviews,
  recordPreview,
  teardownIdentity,
} from "./client-preview-records.ts";
import { previewPolicy } from "./preview-policy.ts";

const records: PreviewRecord[] = [
  {
    id: 11,
    payload: { kind: "client-preview-v1", pull: 41, sites: ["removed-app"] },
  },
  {
    id: 12,
    payload: {
      kind: "client-preview-v1",
      pull: 41,
      sites: ["access-electric"],
    },
  },
  {
    id: 13,
    payload: { kind: "client-preview-v1", pull: 42, sites: ["equityfast"] },
  },
];

/** Fake only the external GitHub API; retain pagination and status ordering. */
const github = () => {
  const states = new Map<number, string>();
  const api: GitHubApi = (route, body) => {
    const status = /\/deployments\/(?<id>\d+)\/statuses/u.exec(route);
    if (status !== null) {
      const id = Number(status.groups?.id);
      if (body !== undefined) {
        if (!("state" in body)) {
          throw new Error("Expected deployment status");
        }
        states.set(id, body.state);
        return JSON.stringify({ state: body.state });
      }
      const state = states.get(id);
      return JSON.stringify(state === undefined ? [[]] : [[{ state }]]);
    }
    return JSON.stringify([[records[0]], [records[1], records[2]]]);
  };
  return api;
};

const selectedPreviewApi: GitHubApi = (route) => {
  if (route.endsWith("/11/statuses?per_page=100")) {
    return '[[{"state":"inactive"}]]';
  }
  if (route.endsWith("/12/statuses?per_page=100")) {
    return "[[]]";
  }
  if (route.includes("/statuses")) {
    throw new Error("Unrelated PR history is unavailable");
  }
  return JSON.stringify([[records[0]], [records[1], records[2]]]);
};

describe("client preview lifecycle", () => {
  it("loads only the selected PR's histories while retaining paginated partial attempts", () => {
    expect(
      activePreviews(selectedPreviewApi, "jbolabs/sites", 41)
    ).toStrictEqual([
      {
        id: 12,
        payload: {
          kind: "client-preview-v1",
          pull: 41,
          sites: ["access-electric"],
        },
      },
    ]);
    expect(() =>
      activePreviews(selectedPreviewApi, "jbolabs/sites", 0)
    ).toThrow("Invalid preview PR number");
  });

  it("records exact ownership before cloud work and prevents automatic retirement of other PRs", () => {
    let payload: GitHubRequest | undefined;
    const api: GitHubApi = (_route, body) => {
      payload = body;
      return JSON.stringify({ id: 91 });
    };
    expect(
      recordPreview(
        api,
        "jbolabs/sites",
        41,
        ["access-electric"],
        "0123456789abcdef0123456789abcdef01234567"
      )
    ).toBe(91);
    expect(payload).toStrictEqual({
      auto_merge: false,
      environment: "client-preview-inventory",
      payload: {
        kind: "client-preview-v1",
        pull: 41,
        sites: ["access-electric"],
      },
      production_environment: false,
      ref: "0123456789abcdef0123456789abcdef01234567",
      required_contexts: [],
      task: "client-preview",
      transient_environment: true,
    });
  });

  it("discovers partial attempts across pages and unions apps removed from the current checkout", () => {
    expect(
      retiredClientPreviews(
        activePreviews(github(), "jbolabs/sites"),
        new Set([42])
      )
    ).toStrictEqual([
      {
        pull: 41,
        records: [11, 12],
        sites: ["access-electric", "removed-app"],
      },
    ]);
  });

  it("destroys owned resources and retires records only after every site and notice succeed", async () => {
    const api = github();
    const resources = new Set([
      "access-electric/client-pr-41",
      "removed-app/client-pr-41",
      "equityfast/client-pr-42",
      "access-electric/staging",
    ]);
    const notices: string[] = [];
    const retired = await reconcileClientPreviews(
      activePreviews(api, "jbolabs/sites"),
      new Set([42]),
      {
        api,
        destroy: (site, stage) => {
          resources.delete(`${site}/${stage}`);
        },
        repository: "jbolabs/sites",
        retireComment: (pull) => {
          notices.push(`retired:${pull}`);
        },
      }
    );
    expect(retired).toStrictEqual(["client-pr-41"]);
    expect([...resources].toSorted()).toStrictEqual([
      "access-electric/staging",
      "equityfast/client-pr-42",
    ]);
    expect(notices).toStrictEqual(["retired:41"]);
    expect(
      activePreviews(api, "jbolabs/sites").map((record) => record.id)
    ).toStrictEqual([13]);
  });

  it("keeps failed teardown ownership available for the next cleanup run", async () => {
    const api = github();
    await expect(
      reconcileClientPreviews(records, new Set([42]), {
        api,
        destroy: () => {
          throw new Error("Cloudflare unavailable");
        },
        repository: "jbolabs/sites",
        retireComment: () => {
          throw new Error("Must not retire failed cleanup");
        },
      })
    ).rejects.toThrow("Cloudflare unavailable");
    expect(
      activePreviews(api, "jbolabs/sites").map((record) => record.id)
    ).toStrictEqual([11, 12, 13]);
  });

  it("retries a partially destroyed preview without touching the other PR", async () => {
    const api = github();
    const resources = new Set(["access-electric", "removed-app", "equityfast"]);
    await expect(
      reconcileClientPreviews(records, new Set([42]), {
        api,
        destroy: (site) => {
          if (site === "removed-app") {
            throw new Error("R2 unavailable");
          }
          resources.delete(site);
        },
        repository: "jbolabs/sites",
        retireComment: () => {
          throw new Error("Not yet retired");
        },
      })
    ).rejects.toThrow("R2 unavailable");
    expect([...resources].toSorted()).toStrictEqual([
      "equityfast",
      "removed-app",
    ]);
    expect(
      activePreviews(api, "jbolabs/sites").map((record) => record.id)
    ).toStrictEqual([11, 12, 13]);
    await expect(
      reconcileClientPreviews(
        activePreviews(api, "jbolabs/sites"),
        new Set([42]),
        {
          api,
          destroy: (site) => {
            resources.delete(site);
          },
          repository: "jbolabs/sites",
          retireComment: () => {
            /* External notice succeeds on retry. */
          },
        }
      )
    ).resolves.toStrictEqual(["client-pr-41"]);
    expect({
      active: activePreviews(api, "jbolabs/sites").map((record) => record.id),
      resources: [...resources],
    }).toStrictEqual({ active: [13], resources: ["equityfast"] });
  });

  it("rechecks relabeling/reopening, closed PRs and stale heads independently of developer previews", () => {
    const pull = {
      headRefOid: "new",
      labels: [{ name: "client-preview" }],
      state: "OPEN" as const,
    };
    expect(previewPolicy(pull, "new", "client-preview")).toStrictEqual({
      content: "seed",
      deploy: true,
      destroy: false,
    });
    expect(previewPolicy(pull, "old", "client-preview")).toStrictEqual({
      content: "seed",
      deploy: false,
      destroy: false,
    });
    expect(previewPolicy(pull, undefined, "client-preview")).toStrictEqual({
      content: "seed",
      deploy: false,
      destroy: false,
    });
    expect(
      previewPolicy(
        { ...pull, labels: [{ name: "preview" }] },
        "new",
        "client-preview"
      )
    ).toStrictEqual({ content: "seed", deploy: false, destroy: true });
    expect(
      previewPolicy({ ...pull, state: "MERGED" }, "new", "client-preview")
    ).toStrictEqual({ content: "seed", deploy: false, destroy: true });
  });

  it("rejects teardown of production, staging, developer previews and invalid site paths", () => {
    expect(teardownIdentity("access-electric", "client-pr-41")).toStrictEqual({
      site: "access-electric",
      stage: "client-pr-41",
    });
    for (const stage of ["prod", "staging", "pr-41", "client-pr-0"]) {
      expect(() => teardownIdentity("access-electric", stage)).toThrow(
        "Teardown is restricted"
      );
    }
    expect(() => teardownIdentity("../studio", "client-pr-41")).toThrow(
      "Teardown is restricted"
    );
  });
});
