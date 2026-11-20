import { describe, expect, it } from "vitest";

import { instagramMedia } from "./instagram.ts";

describe(instagramMedia, () => {
  it("reads a reel share link and drops the tracking query", () => {
    expect(
      instagramMedia(
        "https://www.instagram.com/reel/DP_jRZ9kfRp/?jplx=bm1kbmhheGcyczFj"
      )
    ).toStrictEqual({
      code: "DP_jRZ9kfRp",
      embedUrl: "https://www.instagram.com/reel/DP_jRZ9kfRp/embed/",
      kind: "reel",
      url: "https://www.instagram.com/reel/DP_jRZ9kfRp/",
    });
  });

  it("reads a post link with the account name in the path", () => {
    expect(
      instagramMedia("https://instagram.com/aniwenger/p/B7kLmN0pQrS")
    ).toStrictEqual({
      code: "B7kLmN0pQrS",
      embedUrl: "https://www.instagram.com/p/B7kLmN0pQrS/embed/",
      kind: "post",
      url: "https://www.instagram.com/p/B7kLmN0pQrS/",
    });
  });

  it("treats /reels/ and old /tv/ links as reels, ignoring spaces around the paste", () => {
    expect(
      instagramMedia("  https://www.instagram.com/reels/DbSLFXmPuWN/  ")?.url
    ).toBe("https://www.instagram.com/reel/DbSLFXmPuWN/");
    expect(instagramMedia("https://m.instagram.com/tv/DbSLFXmPuWN")?.kind).toBe(
      "reel"
    );
  });

  it("refuses other sites, profiles, highlights and lookalike hosts", () => {
    const refused = [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.instagram.com/aniwenger/",
      "https://www.instagram.com/stories/highlights/17912345678901234/",
      "https://instagram.com.evil.example/reel/DP_jRZ9kfRp/",
      "mailto:ani@instagram.com",
      "not a link",
    ];
    expect(
      refused.map((link) => instagramMedia(link) ?? "refused")
    ).toStrictEqual(refused.map(() => "refused"));
    expect(
      instagramMedia("https://www.instagram.com/reel/DP_jRZ9kfRp/")?.code
    ).toBe("DP_jRZ9kfRp");
  });
});
