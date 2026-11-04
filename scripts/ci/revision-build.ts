import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { Schema } from "effect";

import {
  fingerprintFailure,
  fingerprintFiles,
  sitePayload,
} from "./site-fingerprint.ts";

export interface RevisionFingerprints {
  readonly base: Readonly<Record<string, string>>;
  readonly head: Readonly<Record<string, string>>;
}

const InputValues = Schema.Record(Schema.String, Schema.Unknown);

/** Compile the production-only CMS email runtime as well as the local Worker.
 * This public inert sender activates its integration; builds never send mail.
 * Keep all other prepared inputs identical to credential-free CI verification.
 */
export const comparisonBuildInputs = (inputs: typeof InputValues.Type) => ({
  ...inputs,
  emailFrom: "fingerprint@example.invalid",
  emailFromName: "CI fingerprint",
});

/** Child logs must not become GitHub outputs or disclose a build script's env. */
const command = (
  cwd: string,
  executable: string,
  args: readonly string[]
): string =>
  execFileSync(executable, args, {
    cwd,
    encoding: "utf-8",
    maxBuffer: 16 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 240_000,
  });

const fingerprintRevision = async (
  root: string,
  directory: string,
  ref: string,
  sites: readonly string[]
): Promise<Readonly<Record<string, string>>> => {
  const started = performance.now();
  const report = path.join(root, ".artifacts/ci/affected/fingerprints", ref);
  rmSync(report, { force: true, recursive: true });
  mkdirSync(report, { recursive: true });
  let phase = "checkout";
  try {
    command(directory, "git", [
      "-c",
      "core.hooksPath=/dev/null",
      "checkout",
      "--detach",
      ref,
    ]);
    for (const site of sites) {
      for (const generated of ["dist", "public/_seed", ".emdash", ".astro"]) {
        rmSync(path.join(directory, "apps", site, generated), {
          force: true,
          recursive: true,
        });
      }
    }
    // Reuse downloads but resolve each revision's own lock/workspace links.
    // Never install a shared Git hook pointing into this disposable checkout.
    phase = "install";
    command(directory, "bun", [
      "install",
      "--frozen-lockfile",
      "--ignore-scripts",
    ]);
    phase = "prepare";
    command(directory, "bun", [
      "scripts/ci/local-verify.ts",
      "--prepare",
      "--sites",
      JSON.stringify(sites),
    ]);
    for (const site of sites) {
      const file = path.join(directory, "apps", site, ".build-inputs.json");
      const inputs = Schema.decodeUnknownSync(
        Schema.fromJsonString(InputValues)
      )(readFileSync(file, "utf-8"));
      writeFileSync(
        file,
        `${JSON.stringify(comparisonBuildInputs(inputs), null, 2)}\n`
      );
    }
    phase = "build";
    const output = command(directory, "bun", [
      "x",
      "turbo",
      "run",
      "build",
      ...sites.map((site) => `--filter=@sites/${site}`),
    ]);
    const cached = /Cached:\s*(?<count>\d+) cached, (?<total>\d+) total/u.exec(
      output
    )?.groups;
    if (cached !== undefined) {
      process.stderr.write(
        `${ref}: Turbo restored ${cached.count}/${cached.total} tasks\n`
      );
    }
    phase = "fingerprint";
    const results = await Promise.allSettled(
      sites.map(async (site) => {
        const payload = await sitePayload(directory, site);
        const parts = payload.map((file) => ({
          fingerprint: fingerprintFiles([file]),
          name: file.name,
        }));
        writeFileSync(
          path.join(report, `${site}.json`),
          JSON.stringify(parts, null, 2)
        );
        return [site, fingerprintFiles(payload)] as const;
      })
    );
    const fingerprints = Object.fromEntries(
      results.flatMap((result, index) => {
        if (result.status === "fulfilled") {
          return [result.value];
        }
        const failure = {
          reason: fingerprintFailure(result.reason),
          site: sites[index],
        };
        writeFileSync(
          path.join(report, `${sites[index]}.failure.json`),
          JSON.stringify(failure, null, 2)
        );
        process.stderr.write(
          `::warning::Fingerprint unavailable; retaining candidate: ${JSON.stringify(failure).replaceAll("%", "%25")}\n`
        );
        return [];
      })
    );
    process.stderr.write(`${ref}: ${JSON.stringify(fingerprints)}\n`);
    return fingerprints;
  } catch (error) {
    const failure = { phase, reason: fingerprintFailure(error), revision: ref };
    writeFileSync(
      path.join(report, "failure.json"),
      JSON.stringify(failure, null, 2)
    );
    process.stderr.write(
      `::warning::Build/fingerprint unavailable; retaining candidates: ${JSON.stringify(failure).replaceAll("%", "%25")}\n`
    );
    return {};
  } finally {
    process.stderr.write(
      `${ref}: comparison build finished in ${((performance.now() - started) / 1000).toFixed(1)}s\n`
    );
  }
};

/** Resolve refs in the caller before moving HEAD in the comparison checkout. */
export const revisionPair = (root: string, base: string, head: string) => ({
  base: command(root, "git", [
    "rev-parse",
    "--verify",
    `${base}^{commit}`,
  ]).trim(),
  head: command(root, "git", [
    "rev-parse",
    "--verify",
    `${head}^{commit}`,
  ]).trim(),
});

/** One isolated checkout for both revisions avoids two dependency trees and
 * reuses font/compiler downloads. Clean generated payloads prevent stale files
 * (including deleted media) from contaminating the next revision's output.
 */
export const compareRevisionFingerprints = async (
  root: string,
  base: string,
  head: string,
  sites: readonly string[]
): Promise<RevisionFingerprints> => {
  if (sites.length === 0) {
    return { base: {}, head: {} };
  }
  const revisions = revisionPair(root, base, head);
  const temporary = mkdtempSync(path.join(os.tmpdir(), "sites-revision-"));
  const directory = path.join(temporary, "worktree");
  try {
    command(root, "git", [
      "-c",
      "core.hooksPath=/dev/null",
      "worktree",
      "add",
      "--detach",
      directory,
      revisions.base,
    ]);
    const before = await fingerprintRevision(
      root,
      directory,
      revisions.base,
      sites
    );
    const comparable = sites.filter((site) => before[site] !== undefined);
    const after =
      comparable.length > 0
        ? await fingerprintRevision(root, directory, revisions.head, comparable)
        : {};
    return { base: before, head: after };
  } catch {
    process.stderr.write(
      "Cannot prepare comparison checkout; retaining candidates\n"
    );
    return { base: {}, head: {} };
  } finally {
    try {
      rmSync(directory, { force: true, recursive: true });
      command(root, "git", ["worktree", "remove", "--force", directory]);
    } finally {
      rmSync(temporary, { force: true, recursive: true });
    }
  }
};
