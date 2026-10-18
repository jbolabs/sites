import { describe, expect, it } from "vitest";

import { liveEmbedUrl, videoEmbed } from "./video.ts";

describe(videoEmbed, () => {
  it("embeds a YouTube watch link without cookies", () => {
    expect(
      videoEmbed("https://www.youtube.com/watch?v=wNjDG9HyoHQ")
    ).toStrictEqual({
      embedUrl:
        "https://www.youtube-nocookie.com/embed/wNjDG9HyoHQ?autoplay=1&rel=0",
      provider: "youtube",
    });
  });

  it("reads YouTube live and short links", () => {
    expect(videoEmbed("https://youtube.com/live/7l6cOc8Bcz0")?.embedUrl).toBe(
      "https://www.youtube-nocookie.com/embed/7l6cOc8Bcz0?autoplay=1&rel=0"
    );
    expect(videoEmbed("https://youtu.be/wwVN9m1ZK9M")?.embedUrl).toBe(
      "https://www.youtube-nocookie.com/embed/wwVN9m1ZK9M?autoplay=1&rel=0"
    );
  });

  it("embeds Vimeo page and player links with do-not-track", () => {
    expect(videoEmbed("https://vimeo.com/159704162")).toStrictEqual({
      embedUrl: "https://player.vimeo.com/video/159704162?autoplay=1&dnt=1",
      provider: "vimeo",
    });
    expect(videoEmbed("//player.vimeo.com/video/61113816")?.embedUrl).toBe(
      "https://player.vimeo.com/video/61113816?autoplay=1&dnt=1"
    );
  });

  it("keeps an unlisted Vimeo video's privacy hash", () => {
    expect(videoEmbed("https://vimeo.com/159704162/a1b2c3d4e5")?.embedUrl).toBe(
      "https://player.vimeo.com/video/159704162?autoplay=1&dnt=1&h=a1b2c3d4e5"
    );
  });

  it("refuses links it cannot play", () => {
    expect(
      videoEmbed("https://notyoutube.com/watch?v=wNjDG9HyoHQ")
    ).toBeUndefined();
    expect(videoEmbed("https://vimeopro.com/agapeoc/songs")).toBeUndefined();
    expect(videoEmbed("not a url")).toBeUndefined();
    expect(
      videoEmbed("https://www.youtube.com/watch?v=7l6cOc8Bcz0")?.provider
    ).toBe("youtube");
  });
});

describe(liveEmbedUrl, () => {
  it("plays the channel's current live stream", () => {
    expect(liveEmbedUrl("UCIkKjSC6KJqtMrfTNUrEC7g")).toBe(
      "https://www.youtube-nocookie.com/embed/live_stream?channel=UCIkKjSC6KJqtMrfTNUrEC7g&autoplay=1"
    );
  });
});
