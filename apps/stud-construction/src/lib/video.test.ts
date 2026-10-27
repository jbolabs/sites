import { describe, expect, it } from "vitest";

import { youTubeId } from "./video";

describe(youTubeId, () => {
  it("reads the id from the link shapes editors paste", () => {
    expect(youTubeId("https://www.youtube.com/watch?v=IVuvrxv24UE&t=30s")).toBe(
      "IVuvrxv24UE"
    );
    expect(youTubeId("https://youtu.be/WR_vLnlv3IU")).toBe("WR_vLnlv3IU");
    expect(youTubeId("https://www.youtube.com/shorts/bL6cD98cenc")).toBe(
      "bL6cD98cenc"
    );
    expect(
      youTubeId("https://www.youtube-nocookie.com/embed/cNvzSWn58aU")
    ).toBe("cNvzSWn58aU");
    expect(youTubeId("https://m.youtube.com/watch?v=nGDkXGbywvA")).toBe(
      "nGDkXGbywvA"
    );
  });

  it("rejects links that are not a single YouTube video", () => {
    expect(youTubeId("https://vimeo.com/123456789")).toBeUndefined();
    expect(
      youTubeId("https://www.youtube.com/@studconstruction")
    ).toBeUndefined();
    expect(youTubeId("not a url")).toBeUndefined();
    expect(youTubeId("https://www.youtube.com/watch?v=IVuvrxv24UE")).toBe(
      "IVuvrxv24UE"
    );
  });
});
