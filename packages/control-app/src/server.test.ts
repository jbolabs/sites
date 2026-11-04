import { describe, expect, it } from "vitest";

import { hasRunFailed, isWedged } from "./server.ts";

describe(isWedged, () => {
  it("flags the font data Astro drops when a cold boot re-optimizes", () => {
    expect(
      isWedged(
        '[Website] workerd/server/server.c++:6685: error: Uncaught exception: remote.jsg.Error: FontFamilyNotFound: No data was found for the `"--font-body"` family passed to the `<Font>` component.'
      )
    ).toBeTruthy();
  });

  it("flags a second React copy left by a mid-boot reload", () => {
    expect(
      isWedged(
        "[Website] TypeError: Cannot read properties of null (reading 'useState')"
      )
    ).toBeTruthy();
  });

  it("lets the transient errors of an in-progress optimize keep polling", () => {
    expect(
      isWedged(
        "[Website] [vite] program reload\n[Website]   code: 'ERR_FILE_NOT_FOUND_IN_OPTIMIZED_DEP_DIR',"
      )
    ).toBeFalsy();
  });
});

describe(hasRunFailed, () => {
  it("flags a stack that alchemy dev could not import", () => {
    expect(
      hasRunFailed(
        "alchemy dev: run failed; waiting for the next file change to retry.\nResolveMessage: Cannot find package 'alchemy' imported from apps/ms-custom-homes/alchemy.run.ts"
      )
    ).toBeTruthy();
  });

  it("flags a dev server whose Vite child exited before it was ready", () => {
    expect(
      hasRunFailed(
        "[Website] fail (local) — Vite child exited with code 1 before becoming ready (152ms)\nalchemy dev: apply failed; keeping dev alive so healthy resources keep serving."
      )
    ).toBeTruthy();
  });

  it("lets a boot that is still starting keep polling", () => {
    expect(
      hasRunFailed(
        "INFO (#29): Importing stack module\nINFO (#29): Resolving stack services"
      )
    ).toBeFalsy();
  });
});
