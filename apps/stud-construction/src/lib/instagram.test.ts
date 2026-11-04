import { describe, expect, it } from "vitest";

import { checkInstagramLinks, instagramLink } from "./instagram";

describe(instagramLink, () => {
  it("reads a reel share link and drops the tracking query", () => {
    expect(
      instagramLink(
        "https://www.instagram.com/reel/C9xYz12AbCd/?igsh=MWQ1ZGUxMzBkMA=="
      )
    ).toStrictEqual({
      code: "C9xYz12AbCd",
      embedUrl: "https://www.instagram.com/reel/C9xYz12AbCd/embed/",
      kind: "reel",
      url: "https://www.instagram.com/reel/C9xYz12AbCd/",
    });
  });

  it("reads a post link with the account name in the path", () => {
    expect(
      instagramLink("https://instagram.com/studconstruction/p/B7kLmN0pQrS")?.url
    ).toBe("https://www.instagram.com/p/B7kLmN0pQrS/");
  });

  it("treats /reels/ and old /tv/ links as reels", () => {
    expect(
      instagramLink("https://www.instagram.com/reels/C9xYz12AbCd/")?.kind
    ).toBe("reel");
    expect(instagramLink("https://m.instagram.com/tv/C9xYz12AbCd")?.url).toBe(
      "https://www.instagram.com/reel/C9xYz12AbCd/"
    );
  });

  it("reads a story highlight as a link without an embed", () => {
    expect(
      instagramLink(
        "https://www.instagram.com/stories/highlights/17912345678901234/"
      )
    ).toStrictEqual({
      id: "17912345678901234",
      kind: "highlight",
      url: "https://www.instagram.com/stories/highlights/17912345678901234/",
    });
  });

  it("refuses other sites, profiles, and lookalike hosts", () => {
    const refused = [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.instagram.com/studconstruction/",
      "https://instagram.com.evil.example/reel/C9xYz12AbCd/",
      "mailto:office@studconstruction.net",
      "not a link",
    ].map((url) => instagramLink(url)?.url ?? "refused");
    expect(refused).toStrictEqual([
      "refused",
      "refused",
      "refused",
      "refused",
      "refused",
    ]);
  });
});

describe(checkInstagramLinks, () => {
  it("cleans good links and drops blank rows", () => {
    expect(
      checkInstagramLinks([
        "https://www.instagram.com/reel/C9xYz12AbCd/?igsh=abc",
        "  ",
        "https://instagram.com/studconstruction/p/B7kLmN0pQrS/",
      ])
    ).toStrictEqual({
      urls: [
        "https://www.instagram.com/reel/C9xYz12AbCd/",
        "https://www.instagram.com/p/B7kLmN0pQrS/",
      ],
    });
  });

  it("names the link it refuses", () => {
    expect(
      checkInstagramLinks([
        "https://www.instagram.com/reel/C9xYz12AbCd/",
        "https://www.tiktok.com/@stud/video/1",
      ]).refused
    ).toBe(
      '"https://www.tiktok.com/@stud/video/1" is not an Instagram post, reel, or highlight. In Instagram, tap Share, then Copy link, and paste that link here.'
    );
  });
});
