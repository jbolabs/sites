import { describe, expect, it } from "vitest";

import { youtubeId } from "./video.ts";

describe(youtubeId, () => {
  it("reads the id from every link shape YouTube hands out", () => {
    expect(youtubeId("https://www.youtube.com/watch?v=M9neSO0mLwE")).toBe(
      "M9neSO0mLwE"
    );
    expect(youtubeId("https://youtu.be/rcWtc6b2UKo?si=abc")).toBe(
      "rcWtc6b2UKo"
    );
    expect(
      youtubeId("https://www.youtube.com/live/Hk_8CcNMX7I?feature=share")
    ).toBe("Hk_8CcNMX7I");
    expect(youtubeId("https://www.youtube.com/embed/K4x2TDpPyno")).toBe(
      "K4x2TDpPyno"
    );
  });

  it("ignores links that are not YouTube videos", () => {
    expect(youtubeId("https://vimeo.com/123456789")).toBeUndefined();
    expect(youtubeId("not a link")).toBeUndefined();
    expect(youtubeId("https://www.youtube.com/watch?v=M9neSO0mLwE")).toBe(
      "M9neSO0mLwE"
    );
  });
});
