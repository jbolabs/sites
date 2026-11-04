import { listSites } from "@jakebodea/control-app/site";
import { describe, expect, it } from "vitest";

import {
  deployableFiles,
  authoredInputFiles,
  FingerprintUnavailable,
  deploymentResolutions,
  fingerprintFailure,
  fingerprintFiles,
  normalizeModules,
  workerModules,
} from "./site-fingerprint.ts";

describe("fingerprint diagnostics and tracked provenance", () => {
  it("reports controlled reasons without exposing arbitrary child-process errors", () => {
    expect(
      fingerprintFailure(
        new FingerprintUnavailable({ message: "Missing Worker entry.mjs" })
      )
    ).toBe("Missing Worker entry.mjs");
    expect(fingerprintFailure(new Error("TOKEN=do-not-print"))).toBe(
      "Unexpected comparison error; details suppressed"
    );
  });

  it.each(listSites(new URL("../../", import.meta.url).pathname))(
    "can normalize authored inputs for %s before any builds",
    (site) => {
      const files = authoredInputFiles(
        new URL("../../", import.meta.url).pathname,
        site
      );
      expect(files.map(({ name }) => name)).toContain(
        `apps/${site}/site.config.ts`
      );
      expect(
        deployableFiles(["export const ready = true;"], [], files).map(
          ({ name, bytes }) => ({
            name,
            text: Buffer.from(bytes).toString("utf-8"),
          })
        )
      ).toStrictEqual([
        { name: "worker-graph", text: '["export const ready = true;"]' },
      ]);
    }
  );

  it("identifies the authored file that cannot be normalized", () => {
    expect(() =>
      deployableFiles(
        ["export const ready = true;"],
        [],
        [
          {
            bytes: Buffer.from(String.raw`const token="\u0061";`),
            name: "apps/example/input.ts",
          },
        ]
      )
    ).toThrow(
      "apps/example/input.ts: Authored scope token; retaining candidate"
    );
  });
});

describe(workerModules, () => {
  it("assigns identities through cycles, retaining module bytes and graph edges", () => {
    expect(
      workerModules(
        new Map([
          ["chunks/a-hash.mjs", 'import "./b-hash.mjs"; export const a = 1;'],
          ["chunks/b-hash.mjs", 'import "./a-hash.mjs"; export const b = 2;'],
          ["entry.mjs", 'export * from "./chunks/a-hash.mjs";'],
        ])
      )
    ).toStrictEqual([
      'export * from "<module:1>";',
      'import "<module:2>"; export const a = 1;',
      'import "<module:1>"; export const b = 2;',
    ]);
  });

  it("normalizes generated names in manifest references, retaining changed content", () => {
    expect(
      workerModules(
        new Map([
          ["entry.mjs", 'const entries = { a: "chunks/a-new.mjs" };'],
          ["chunks/a-new.mjs", 'export const a = "changed";'],
          ["chunks/unreferenced.mjs", "export const extra = 3;"],
        ])
      )
    ).toStrictEqual([
      'const entries = { a: "<module:1>" };',
      'export const a = "changed";',
      "export const extra = 3;",
    ]);
  });

  it("preserves distinct edges when the same modules are wired differently", () => {
    expect(
      workerModules(
        new Map([
          ["entry.mjs", 'import "./chunks/b.mjs"; import "./chunks/a.mjs";'],
          ["chunks/a.mjs", 'export const value = "a";'],
          ["chunks/b.mjs", 'export const value = "b";'],
        ])
      )
    ).toStrictEqual([
      'import "<module:1>"; import "<module:2>";',
      'export const value = "b";',
      'export const value = "a";',
    ]);
  });

  it("rejects incomplete builds and ambiguous disconnected modules", () => {
    expect(() => workerModules(new Map())).toThrow("Missing Worker entry.mjs");
    expect(() =>
      workerModules(
        new Map([
          ["entry.mjs", "export {};"],
          ["chunks/a.mjs", "export {};"],
          ["chunks/b.mjs", "export {};"],
        ])
      )
    ).toThrow("Ambiguous disconnected Worker modules");
  });
});

describe(normalizeModules, () => {
  it("normalizes only documented build metadata and orders the entry map", () => {
    expect([
      ...normalizeModules(
        new Map([
          [
            "entry.mjs",
            'deserializeManifest({"rootDir":"file:///tmp/base/apps/demo/","key":"random-key","entryModules":{"z":"chunks/z.mjs","a":"chunks/a.mjs"},"meaningful":"changed"});',
          ],
          [
            "chunks/a.mjs",
            '//#region \\0virtual:emdash/build\nvar buildTime = 123456;\nconst timestamp = 789; const source = "/tmp/base/apps/demo/src/file.astro";',
          ],
        ])
      ),
    ]).toStrictEqual([
      [
        "entry.mjs",
        'deserializeManifest({"rootDir":"file://<checkout>/apps/demo/","key":"<astro-build-key>","entryModules":{"a":"chunks/a.mjs","z":"chunks/z.mjs"},"meaningful":"changed"});',
      ],
      [
        "chunks/a.mjs",
        '//#region \\0virtual:emdash/build\nvar buildTime = 0;\nconst timestamp = 789; const source = "<checkout>/apps/demo/src/file.astro";',
      ],
    ]);
  });

  it("fails closed when the adapter no longer emits the known manifest", () => {
    expect(() =>
      normalizeModules(new Map([["entry.mjs", "export default 1;"]]))
    ).toThrow("Expected exactly one Astro checkout root");
  });
});

describe(deploymentResolutions, () => {
  it("follows external stack dependencies and peers without unrelated new-site packages", () => {
    expect(
      deploymentResolutions(
        {
          alchemy: [
            "alchemy@2",
            "",
            { dependencies: { effect: "4" } },
            "hash-a",
          ],
          effect: [
            "effect@4",
            "",
            { peerDependencies: { optional: "1" } },
            "hash-e",
          ],
          unused: ["unused@9", "", {}, "hash-u"],
        },
        ["alchemy/Cloudflare"]
      )
    ).toBe(
      '[["alchemy",["alchemy@2","",{"dependencies":{"effect":"4"}},"hash-a"]],["effect",["effect@4","",{"peerDependencies":{"optional":"1"}},"hash-e"]]]'
    );
  });

  it("includes nested resolutions and refuses an unknown required dependency", () => {
    expect(
      deploymentResolutions(
        {
          effect: ["effect@4", "", {}, "hash-e"],
          "other/effect": ["effect@3", "", {}, "hash-old"],
        },
        ["effect"]
      )
    ).toBe(
      '[["effect",["effect@4","",{},"hash-e"]],["other/effect",["effect@3","",{},"hash-old"]]]'
    );
    expect(() =>
      deploymentResolutions(
        { alchemy: ["alchemy@2", "", { dependencies: { missing: "1" } }] },
        ["alchemy"]
      )
    ).toThrow("Missing deployment dependency: missing");
  });
});

describe(fingerprintFiles, () => {
  it("hashes literal bytes with their names using SHA-256", () => {
    expect(
      fingerprintFiles([
        { bytes: new TextEncoder().encode("hello"), name: "a" },
      ])
    ).toBe("55cbf5ef3877fdcdfbf1f1d12514945a2b01b61455ea92ef537700c373adb160");
  });
});

describe(deployableFiles, () => {
  it("keeps scoped style relationships and asset content while normalizing path-derived names", () => {
    const files = deployableFiles(
      [
        'const body="<div data-astro-cid-abcdefgh>";const href="/_astro/main.PATHHASH.css";',
      ],
      [
        {
          bytes: new TextEncoder().encode(
            ".x[data-astro-cid-abcdefgh]{color:red}"
          ),
          generated: true,
          name: "client/_astro/main.PATHHASH.css",
        },
      ]
    );
    expect(
      files.map(({ name, bytes }) => ({
        name,
        text: new TextDecoder().decode(bytes),
      }))
    ).toStrictEqual([
      {
        name: "worker-graph",
        text: String.raw`["const body=\"<div data-astro-cid-<scope:0>>\";const href=\"/_astro/main.<hash>.css<asset:0>\";"]`,
      },
      {
        name: "client/_astro/main.<hash>.css<asset:0>",
        text: ".x[data-astro-cid-<scope:0>]{color:red}",
      },
    ]);
  });

  it("retains public asset paths and literal binary bytes", () => {
    expect(
      deployableFiles(
        ["export default 1;"],
        [
          {
            bytes: new Uint8Array([1, 2, 3]),
            generated: false,
            name: "client/logo.png",
          },
        ]
      ).map(({ name, bytes }) => [name, [...bytes]])
    ).toStrictEqual([
      [
        "worker-graph",
        [
          91, 34, 101, 120, 112, 111, 114, 116, 32, 100, 101, 102, 97, 117, 108,
          116, 32, 49, 59, 34, 93,
        ],
      ],
      ["client/logo.png", [1, 2, 3]],
    ]);
  });
});

describe("normalization safety", () => {
  it("retains ordinary text that resembles a scope hash", () => {
    expect(
      deployableFiles(['const body="<p>astro-abcdefgh</p>";'], []).map(
        ({ bytes }) => new TextDecoder().decode(bytes)
      )
    ).toStrictEqual([String.raw`["const body=\"<p>astro-abcdefgh</p>\";"]`]);
    expect(
      deployableFiles(['const body="<p>astro-ijklmnop</p>";'], []).map(
        ({ bytes }) => new TextDecoder().decode(bytes)
      )
    ).toStrictEqual([String.raw`["const body=\"<p>astro-ijklmnop</p>\";"]`]);
  });

  it("preserves a generated asset's type and stable filename", () => {
    const files = deployableFiles(
      ['const image="/_astro/badge.PATHHASH.svg";'],
      [
        {
          bytes: new TextEncoder().encode("<svg/>"),
          generated: true,
          name: "client/_astro/badge.PATHHASH.svg",
        },
      ]
    );
    expect(files.map(({ name }) => name)).toStrictEqual([
      "worker-graph",
      "client/_astro/badge.<hash>.svg<asset:0>",
    ]);
    const renamed = deployableFiles(
      ['const image="/_astro/badge.PATHHASH.txt";'],
      [
        {
          bytes: new TextEncoder().encode("<svg/>"),
          generated: true,
          name: "client/_astro/badge.PATHHASH.txt",
        },
      ]
    );
    expect(renamed.map(({ name }) => name)).toStrictEqual([
      "worker-graph",
      "client/_astro/badge.<hash>.txt<asset:0>",
    ]);
  });

  it("fails closed for scope-shaped text that collides with an actual generated selector", () => {
    expect(() =>
      deployableFiles(
        ['const body="<p>astro-abcdefgh</p>";'],
        [
          {
            bytes: new TextEncoder().encode(
              "[data-astro-cid-abcdefgh]{color:red}"
            ),
            generated: true,
            name: "client/_astro/page.PATHHASH.css",
          },
        ]
      )
    ).toThrow("Ambiguous scope-like literal; retaining candidate");
  });
});

describe("authored asset provenance", () => {
  it("preserves public filenames even inside the generated-assets URL prefix", () => {
    const files = deployableFiles(
      ['const href="/_astro/promo.20261020.txt";'],
      [
        {
          bytes: new TextEncoder().encode("promo"),
          generated: false,
          name: "client/_astro/promo.20261020.txt",
        },
      ]
    );
    expect(files.map(({ name }) => name)).toStrictEqual([
      "worker-graph",
      "client/_astro/promo.20261020.txt",
    ]);
  });

  it("rejects whitespace-delimited visible text masquerading as an attribute", () => {
    expect(() =>
      deployableFiles(
        ['const body="<p> data-astro-cid-abcdefgh </p>";'],
        [
          {
            bytes: new TextEncoder().encode(
              "[data-astro-cid-abcdefgh]{color:red}"
            ),
            generated: true,
            name: "client/_astro/page.PATHHASH.css",
          },
        ]
      )
    ).toThrow("Ambiguous scope-like literal; retaining candidate");
  });
});

describe("inline compiler styles", () => {
  it("normalizes scoped inline CSS and the corresponding compiled HTML", () => {
    const files = deployableFiles(
      [
        'deserializeManifest({"styles":[{"type":"inline","content":"[data-astro-cid-abcdefgh]{color:red}"}]});const body="<div data-astro-cid-abcdefgh>";',
      ],
      []
    );
    expect(new TextDecoder().decode(files[0]?.bytes)).toBe(
      String.raw`["deserializeManifest({\"styles\":[{\"type\":\"inline\",\"content\":\"[data-astro-cid-<scope:0>]{color:red}\"}],\"assets\":[]});const body=\"<div data-astro-cid-<scope:0>>\";"]`
    );
  });

  it("retains candidates when an inline CSS string contains authored scope-like text", () => {
    expect(() =>
      deployableFiles(
        [
          String.raw`deserializeManifest({"styles":[{"type":"inline","content":"[data-astro-cid-abcdefgh]{content:\"data-astro-cid-abcdefgh\"}"}]});`,
        ],
        []
      )
    ).toThrow("Ambiguous scope-like literal; retaining candidate");
  });
});

describe("authored scope collisions", () => {
  const css = [
    {
      bytes: Buffer.from("[data-astro-cid-abcdefgh]{color:red}"),
      generated: true,
      name: "client/_astro/page.PATHHASH.css",
    },
  ];

  it("retains quoted titles instead of normalizing their visible text", () => {
    expect(() =>
      deployableFiles(
        [`const body="<p title=' data-astro-cid-abcdefgh '>Hello</p>";`],
        css
      )
    ).toThrow("Ambiguous scope-like literal; retaining candidate");
  });

  it("retains ordinary JSON properties instead of treating them as compiler props", () => {
    expect(() =>
      deployableFiles(
        [
          'export default {fetch(){return Response.json({class:"astro-abcdefgh"})}};',
        ],
        css
      )
    ).toThrow("Ambiguous scope-like literal; retaining candidate");
  });

  it("retains even renderer-shaped literals when the token was authored", () => {
    expect(() =>
      deployableFiles(
        [
          'renderComponent(result,"Demo",Demo,{"data-astro-cid-abcdefgh":true});',
        ],
        css,
        [Buffer.from('const token="data-astro-cid-abcdefgh";')]
      )
    ).toThrow("Authored scope token; retaining candidate");
  });
});

describe("decoded authored scope literals", () => {
  const css = [
    {
      bytes: Buffer.from("[data-astro-cid-abcdefgh]{color:red}"),
      generated: true,
      name: "client/_astro/page.PATHHASH.css",
    },
  ];

  it("retains compiler-decoded Unicode in JSON responses", () => {
    expect(() =>
      deployableFiles(
        [
          'export default {fetch(){return Response.json({value:"<p data-astro-cid-abcdefgh>Hello</p>"})}}',
        ],
        css,
        [
          Buffer.from(
            String.raw`export default {fetch(){return Response.json({value:"<p data-astro-cid-\u0061bcdefgh>Hello</p>"})}}`
          ),
        ]
      )
    ).toThrow("Authored scope token; retaining candidate");
  });

  it("retains decoded renderer-shaped props and folded literal concatenations", () => {
    expect(() =>
      deployableFiles(
        ['renderComponent(null,null,null,{class:"astro-abcdefgh"});'],
        css,
        [
          Buffer.from(
            String.raw`renderComponent(null,null,null,{class:"astro-\u0061bcdefgh"});`
          ),
        ]
      )
    ).toThrow("Authored scope token; retaining candidate");
    expect(() =>
      deployableFiles(['const body="<p data-astro-cid-abcdefgh>";'], css, [
        Buffer.from('const body="<p data-astro-" + "cid-abc" + "defgh>";'),
      ])
    ).toThrow("Authored scope token; retaining candidate");
  });
});

describe("authored decoding uncertainty", () => {
  const css = [
    {
      bytes: Buffer.from("[data-astro-cid-abcdefgh]{color:red}"),
      generated: true,
      name: "client/_astro/page.PATHHASH.css",
    },
  ];

  it("retains an escaped literal followed by another property", () => {
    expect(() =>
      deployableFiles(
        ['renderComponent(null,null,null,{class:"astro-abcdefgh",other:"x"});'],
        css,
        [
          Buffer.from(
            String.raw`renderComponent(null,null,null,{class:"astro-\u0061bcdefgh",other:"x"});`
          ),
        ]
      )
    ).toThrow("Authored scope token; retaining candidate");
  });

  it("retains TypeScript angle assertions and folded spellings with trailing literals", () => {
    expect(() =>
      deployableFiles(
        ['renderComponent(null,null,null,{class:"astro-abcdefgh"});'],
        css,
        [
          Buffer.from(
            String.raw`const assertion=<string>"ok";renderComponent(null,null,null,{class:"astro-\u0061bcdefgh"});`
          ),
        ]
      )
    ).toThrow("Authored scope token; retaining candidate");
    expect(() =>
      deployableFiles(
        ['renderComponent(null,null,null,{class:"astro-abcdefgh",other:"x"});'],
        css,
        [
          Buffer.from(
            'const assertion=<string>"ok";renderComponent(null,null,null,{class:"astro-abcd"+"efgh",other:"x"});'
          ),
        ]
      )
    ).toThrow("Authored scope token; retaining candidate");
  });
});
