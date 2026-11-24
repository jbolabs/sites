/**
 * Masked session replay for the paid-ad landing pages (`/lp/`), so a drop-off
 * in the funnel can be watched, not just counted. Privacy comes first on a
 * loan application: every input value and every piece of page text is masked
 * before it leaves the browser, so a recording shows layout, clicks, scrolls
 * and which step a visitor reached, never what they typed or saw in a field.
 *
 * Only replay is switched on: no autocapture, page views (the funnel sends
 * its own), heatmaps, surveys, console logs, network bodies or headers, and
 * no person profiles. Storage is in memory only, so PostHog sets no cookie and
 * writes nothing to the browser. The recording reuses the funnel's visit id,
 * and funnel events carry the recording's session id, so PostHog can link a
 * funnel drop-off to its recording.
 *
 * The SDK loads on demand from the landing pages only. Whether a session is
 * recorded at all (sample rate, minimum length) is set in the PostHog project.
 */
import { KEY_META, linkReplaySession, visitId } from "./funnel.ts";

/** PostHog's US cloud, where the project lives. */
export const API_HOST = "https://us.i.posthog.com";

/** Everything replay records is masked: all input values and all text. */
export const REPLAY_MASKING = {
  maskAllInputs: true,
  maskTextSelector: "*",
  recordBody: false,
  recordCrossOriginIframes: false,
  recordHeaders: false,
} as const;

/** Every PostHog capture feature but replay is off; nothing is stored in the browser. */
export const replayConfig = (visit: string) =>
  ({
    api_host: API_HOST,
    autocapture: false,
    bootstrap: { distinctID: visit },
    capture_dead_clicks: false,
    capture_exceptions: false,
    capture_heatmaps: false,
    capture_pageleave: false,
    capture_pageview: false,
    capture_performance: false,
    disable_conversations: true,
    disable_product_tours: true,
    disable_session_recording: false,
    disable_surveys: true,
    disable_web_experiments: true,
    enable_recording_console_log: false,
    persistence: "memory",
    person_profiles: "never",
    rageclick: false,
    save_referrer: false,
    session_recording: REPLAY_MASKING,
  }) as const;

/** Starts masked replay; does nothing without a project key, and never throws. */
export const startReplay = async (): Promise<void> => {
  try {
    const key =
      document.querySelector<HTMLMetaElement>(`meta[name="${KEY_META}"]`)
        ?.content ?? "";
    if (key === "") {
      return;
    }
    const { default: posthog } = await import("posthog-js");
    posthog.init(key, replayConfig(visitId()));
    linkReplaySession(posthog.get_session_id());
  } catch {
    // Replay is best effort: it must never break the page or the form.
  }
};
