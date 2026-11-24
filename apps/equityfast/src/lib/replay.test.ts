import { describe, expect, it } from "vitest";

import { replayConfig } from "./replay.ts";

describe(replayConfig, () => {
  it("masks every input value and all page text, and records no network data", () => {
    expect(replayConfig("visit-1").session_recording).toStrictEqual({
      maskAllInputs: true,
      maskTextSelector: "*",
      recordBody: false,
      recordCrossOriginIframes: false,
      recordHeaders: false,
    });
  });

  it("turns on replay only, under the funnel's visit id, with no storage, profiles or other capture", () => {
    expect(replayConfig("visit-1")).toMatchObject({
      autocapture: false,
      bootstrap: { distinctID: "visit-1" },
      capture_dead_clicks: false,
      capture_exceptions: false,
      capture_heatmaps: false,
      capture_pageleave: false,
      capture_pageview: false,
      capture_performance: false,
      disable_session_recording: false,
      disable_surveys: true,
      enable_recording_console_log: false,
      persistence: "memory",
      person_profiles: "never",
      rageclick: false,
    });
  });
});
