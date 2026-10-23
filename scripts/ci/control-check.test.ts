import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import type { ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";

import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { controlCheck } from "./control-check.ts";

const Report = Schema.fromJsonString(
  Schema.Struct({
    errors: Schema.Number,
    findings: Schema.Array(
      Schema.Struct({ detail: Schema.String, rule: Schema.String })
    ),
  })
);

// Real PNGs, so the audit's link-preview and icon checks pass on the fixture site.
const FIXTURES = path.resolve(
  import.meta.dirname,
  "../../packages/control-app/src/fixtures"
);
const ASSETS = new Map([
  ["/apple-touch-icon.png", "180x180.png"],
  ["/favicon.png", "180x180.png"],
  ["/og-default.png", "1200x630.png"],
]);

/** A page that passes every content check, apart from the heading `body` supplies. */
const fixturePage = (origin: string, body: string): string =>
  `<!doctype html><html><head><title>Fixture site</title><meta name="description" content="A complete description for a rendered site used to test the SEO command."><link rel="canonical" href="${origin}/"><link rel="icon" href="/favicon.png"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><meta property="og:title" content="Fixture site"><meta property="og:image" content="${origin}/og-default.png"><meta name="twitter:card" content="summary_large_image"></head><body>${body}</body></html>`;

const serveAsset = (
  url: string | undefined,
  response: ServerResponse
): boolean => {
  const file = ASSETS.get(url ?? "");
  if (file === undefined) {
    return false;
  }
  response.setHeader("content-type", "image/png");
  response.end(readFileSync(path.join(FIXTURES, file)));
  return true;
};

describe(controlCheck, () => {
  it.each([true, false])(
    "preserves the real SEO report when passing is %s",
    async (valid) => {
      const output = mkdtempSync(path.join(tmpdir(), "seo-report-"));
      const server = createServer((request, response) => {
        const origin = `http://${request.headers.host}`;
        if (request.url === "/robots.txt") {
          response.end(
            `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
          );
        } else if (request.url === "/sitemap.xml") {
          response.end(`<urlset><url><loc>${origin}/</loc></url></urlset>`);
        } else if (!serveAsset(request.url, response)) {
          response.setHeader("content-type", "text/html");
          response.end(
            fixturePage(
              origin,
              valid ? "<h1>Fixture page</h1>" : "<p>Missing heading</p>"
            )
          );
        }
      });
      try {
        server.listen(0, "localhost");
        await once(server, "listening");
        const address = Schema.decodeUnknownSync(
          Schema.Struct({ port: Schema.Number })
        )(server.address());
        const passed = await controlCheck({
          flags: ["--content-only"],
          name: "seo",
          origin: `http://localhost:${address.port}`,
          output,
          site: "access-electric",
        });
        expect(passed).toBe(valid);
        const report = Schema.decodeUnknownSync(Report)(
          readFileSync(path.join(output, "access-electric-seo.json"), "utf-8")
        );
        expect(report.errors).toBe(valid ? 0 : 1);
        expect(report.findings).toStrictEqual(
          valid ? [] : [{ detail: "0 <h1> elements", rule: "one-h1" }]
        );
      } finally {
        server.close();
        rmSync(output, { force: true, recursive: true });
      }
    }
  );

  it.each([
    { findings: [], flags: [] },
    {
      findings: [
        {
          detail:
            "production sends X-Robots-Tag: noindex, nofollow (auditing another stage? drop --production)",
          rule: "indexable",
        },
      ],
      flags: ["--production"],
    },
  ])(
    "audits a noindex stage against the stage it is told ($flags)",
    async ({ flags, findings }) => {
      const output = mkdtempSync(path.join(tmpdir(), "seo-stage-"));
      const server = createServer((request, response) => {
        const origin = `http://${request.headers.host}`;
        response.setHeader("x-robots-tag", "noindex, nofollow");
        if (request.url === "/robots.txt") {
          response.end(
            `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
          );
        } else if (request.url === "/sitemap.xml") {
          response.end(`<urlset><url><loc>${origin}/</loc></url></urlset>`);
        } else if (!serveAsset(request.url, response)) {
          response.setHeader("content-type", "text/html");
          response.end(fixturePage(origin, "<h1>Fixture page</h1>"));
        }
      });
      try {
        server.listen(0, "localhost");
        await once(server, "listening");
        const address = Schema.decodeUnknownSync(
          Schema.Struct({ port: Schema.Number })
        )(server.address());
        await controlCheck({
          flags,
          name: "seo",
          origin: `http://localhost:${address.port}`,
          output,
          site: "access-electric",
        });
        const report = Schema.decodeUnknownSync(Report)(
          readFileSync(path.join(output, "access-electric-seo.json"), "utf-8")
        );
        expect(
          report.findings.filter((item) =>
            ["indexable", "preview-noindex"].includes(item.rule)
          )
        ).toStrictEqual(findings);
      } finally {
        server.close();
        rmSync(output, { force: true, recursive: true });
      }
    }
  );
});
