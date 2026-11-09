import { describe, expect, it } from "vitest";

import { serviceFor } from "./labels.ts";

describe(serviceFor, () => {
  it("names who the visit is for after the service", () => {
    expect(serviceFor("Gray blending", "women")).toBe("Gray blending (Women)");
  });

  it("leaves the service alone when the client did not say", () => {
    expect(serviceFor("Men's cut")).toBe("Men's cut");
  });
});
