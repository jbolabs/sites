import { describe, expect, it } from "vitest";

import { pushDataLayerEvent } from "./data-layer.ts";
import type { DataLayerTarget } from "./data-layer.ts";

describe(pushDataLayerEvent, () => {
  it("creates the dataLayer when the container has not loaded yet", () => {
    const page: DataLayerTarget = {};
    pushDataLayerEvent("application_submitted", page);
    expect(page.dataLayer).toStrictEqual([{ event: "application_submitted" }]);
  });

  it("appends to the container's existing dataLayer", () => {
    const page = { dataLayer: [{ event: "gtm.js" }] };
    pushDataLayerEvent("application_submitted", page);
    expect(page.dataLayer).toStrictEqual([
      { event: "gtm.js" },
      { event: "application_submitted" },
    ]);
  });
});
